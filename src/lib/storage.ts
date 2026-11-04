import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { presignUrl } from "./s3-presign";

export const UPLOADS = {
  avatar: { maxBytes: 2 * 1024 * 1024, types: { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } },
  timelapse: { maxBytes: 80 * 1024 * 1024, types: { "video/webm": "webm", "video/mp4": "mp4" } },
} as const;

export type UploadKind = keyof typeof UPLOADS;

export type UploadTicket = { key: string; url: string; headers: Record<string, string> };

/** Browsers upload straight to storage, so big files never pass through a serverless function. */
type StorageAdapter = {
  createUpload(key: string, contentType: string, size: number): Promise<UploadTicket>;
  publicUrl(key: string): string;
};

const SAFE_KEY = /^[a-z]+s\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.[a-z0-9]+$/;
export const isSafeKey = (key: string) => SAFE_KEY.test(key);

const localDir = () => process.env.UPLOAD_DIR ?? ".uploads";
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
};

/** Checks a ticket from local.createUpload and returns what it allows. */
export async function readLocalTicket(token: string) {
  const { payload } = await jwtVerify(token, secret());
  return payload as unknown as { key: string; contentType: string; size: number };
}

export async function writeLocalFile(key: string, bytes: Uint8Array) {
  if (!isSafeKey(key)) throw new Error("Bad key");
  const path = join(localDir(), key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

export async function readLocalFile(key: string) {
  if (!isSafeKey(key)) return null;
  return readFile(join(localDir(), key)).catch(() => null);
}

function s3(): StorageAdapter {
  const env = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set (see README: Media storage)`);
    return value;
  };
  const bucket = env("S3_BUCKET");
  return {
    async createUpload(key, contentType, size) {
      const headers = { "Content-Type": contentType, "Content-Length": String(size) };
      const url = presignUrl({
        method: "PUT",
        endpoint: env("S3_ENDPOINT"),
        path: `/${bucket}/${key}`,
        region: process.env.S3_REGION ?? "auto",
        accessKeyId: env("S3_ACCESS_KEY_ID"),
        secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
        expiresSec: 600,
        now: new Date(),
        headers,
      });
      // browsers set Content-Length themselves and refuse to have it set by hand
      return { key, url, headers: { "Content-Type": contentType } };
    },
    publicUrl: (key) => `${env("S3_PUBLIC_URL").replace(/\/$/, "")}/${key}`,
  };
}

export function storage(): StorageAdapter {
  if (process.env.S3_BUCKET) return s3();
  // serverless disks don't persist, so failing loudly beats losing uploads
  if (process.env.VERCEL) throw new Error("Set the S3_* variables: local uploads don't persist on Vercel");
  return local;
}
