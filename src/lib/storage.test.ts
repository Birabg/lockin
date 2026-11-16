import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { UPLOADS_OFF, storage, uploadsEnabled } = await import("./storage");

const S3 = {
  S3_BUCKET: "b",
  S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_PUBLIC_URL: "https://pub.example.r2.dev",
};

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v as string);
}

describe("storage without S3 on Vercel", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("turns uploads off instead of throwing", async () => {
    setEnv({ VERCEL: "1", ...Object.fromEntries(Object.keys(S3).map((k) => [k, ""])) });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(uploadsEnabled()).toBe(false);
    const store = storage();
    await expect(store.createUpload("avatars/u/a.png", "image/png", 10)).rejects.toThrow(UPLOADS_OFF);
    await expect(store.remove("https://pub.example.r2.dev/avatars/u/a.png")).resolves.toBeUndefined();
    await expect(store.read("avatars/u/a.png")).resolves.toBeNull();
  });

  it("treats a partial S3 setup as off", () => {
    setEnv({ VERCEL: "1", ...S3, S3_SECRET_ACCESS_KEY: "" });
    expect(uploadsEnabled()).toBe(false);
  });

  it("uses S3 when every variable is set", () => {
    setEnv({ VERCEL: "1", ...S3 });
    expect(uploadsEnabled()).toBe(true);
    expect(storage().publicUrl("avatars/u/a.png")).toBe("https://pub.example.r2.dev/avatars/u/a.png");
  });

  it("keeps local disk uploads outside Vercel", () => {
    setEnv({ VERCEL: "", ...Object.fromEntries(Object.keys(S3).map((k) => [k, ""])) });
    expect(uploadsEnabled()).toBe(true);
    expect(storage().publicUrl("avatars/u/a.png")).toBe("/media/avatars/u/a.png");
  });
});
