import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { presignUrl } from "./s3-presign";

export const UPLOADS = {
  avatar: { maxBytes: 2 * 1024 * 1024, types: { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } },
  banner: { maxBytes: 2 * 1024 * 1024, types: { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } },
  timelapse: { maxBytes: 80 * 1024 * 1024, types: { "video/webm": "webm", "video/mp4": "mp4" } },
  photo: { maxBytes: 5 * 1024 * 1024, types: { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } },
} as const;

export type UploadKind = keyof typeof UPLOADS;

export type UploadTicket = { key: string; url: string; headers: Record<string, string> };

/** Browsers upload straight to storage, so big files never pass through a serverless function. */
type StorageAdapter = {
  createUpload(key: string, contentType: string, size: number): Promise<UploadTicket>;
  publicUrl(key: string): string;
  /** Deletes the file behind a URL from publicUrl. */
  remove(url: string): Promise<void>;
  /** For server-side processing. Null when the file isn't there. */
  read(key: string): Promise<Uint8Array | null>;
  write(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
};

const SAFE_KEY = /^[a-z]+s\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.[a-z0-9]+$/;
export const isSafeKey = (key: string) => SAFE_KEY.test(key);

// the hint stops Turbopack tracing the whole project into the server bundle
const localPath = (key: string) => join(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? ".uploads", key);
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

const local: StorageAdapter = {
  async createUpload(key, contentType, size) {
    const token = await new SignJWT({ key, contentType, size })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(secret());
    return { key, url: `/api/uploads?token=${token}`, headers: { "Content-Type": contentType } };
  },
  publicUrl: (key) => `/media/${key}`,
  async remove(url) {
    const key = url.replace(/^\/media\//, "");
    if (isSafeKey(key)) await rm(localPath(key), { force: true });
  },
  read: (key) => readLocalFile(key),
  write: (key, bytes) => writeLocalFile(key, bytes),
};

/** Checks a ticket from local.createUpload and returns what it allows. */
export async function readLocalTicket(token: string) {
  const { payload } = await jwtVerify(token, secret());
  return payload as unknown as { key: string; contentType: string; size: number };
}

export async function writeLocalFile(key: string, bytes: Uint8Array) {
  if (!isSafeKey(key)) throw new Error("Bad key");
  const path = localPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

export async function readLocalFile(key: string) {
  if (!isSafeKey(key)) return null;
  return readFile(localPath(key)).catch(() => null);
}

function s3(): StorageAdapter {
  const env = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set (see README: Media storage)`);
    return value;
  };
  const bucket = env("S3_BUCKET");
  const signed = (method: "GET" | "PUT" | "DELETE", key: string, headers?: Record<string, string>) =>
    presignUrl({
      method,
      endpoint: env("S3_ENDPOINT"),
      path: `/${bucket}/${key}`,
      region: process.env.S3_REGION ?? "auto",
      accessKeyId: env("S3_ACCESS_KEY_ID"),
      secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
      expiresSec: 600,
      now: new Date(),
      headers,
    });
  const base = () => env("S3_PUBLIC_URL").replace(/\/$/, "");
  return {
    async createUpload(key, contentType, size) {
      const headers = { "Content-Type": contentType, "Content-Length": String(size) };
      const url = signed("PUT", key, headers);
      // browsers set Content-Length themselves and refuse to have it set by hand
      return { key, url, headers: { "Content-Type": contentType } };
    },
    publicUrl: (key) => `${base()}/${key}`,
    async remove(url) {
      const key = url.slice(base().length + 1);
      if (!url.startsWith(base()) || !isSafeKey(key)) return;
      const res = await fetch(signed("DELETE", key), { method: "DELETE" });
      if (!res.ok) throw new Error(`Storage delete failed: ${res.status}`);
    },
    async read(key) {
      const res = await fetch(signed("GET", key));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Storage read failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async write(key, bytes, contentType) {
      const headers = { "Content-Type": contentType };
      const res = await fetch(signed("PUT", key, headers), { method: "PUT", headers, body: new Uint8Array(bytes) });
      if (!res.ok) throw new Error(`Storage write failed: ${res.status}`);
    },
  };
}

const S3_VARS = ["S3_BUCKET", "S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_URL"] as const;
const s3Configured = () => S3_VARS.every((name) => process.env[name]);

/** Shown to someone who tries to upload where no storage is set up (e.g. a preview deployment). */
export const UPLOADS_OFF = "Uploads are turned off here because file storage isn't set up yet.";

/**
 * False on Vercel without a complete set of S3_* variables: serverless disks don't persist, so uploads
 * are refused rather than lost. Everything else in the app keeps working.
 */
export const uploadsEnabled = () => s3Configured() || !process.env.VERCEL;

/** Stands in when uploads are off: refuses new files, and has nothing to read or delete. */
const disabled: StorageAdapter = {
  async createUpload() {
    throw new Error(UPLOADS_OFF);
  },
  publicUrl() {
    throw new Error(UPLOADS_OFF);
  },
  async remove(url) {
    console.warn("Storage isn't set up, so this file wasn't deleted:", url);
  },
  read: async () => null,
  async write() {
    throw new Error(UPLOADS_OFF);
  },
};

export function storage(): StorageAdapter {
  if (s3Configured()) return s3();
  if (!process.env.VERCEL) return local;
  const missing = S3_VARS.filter((name) => !process.env[name]);
  console.warn(`Uploads are off: set ${missing.join(", ")} (see README: Media storage)`);
  return disabled;
}
