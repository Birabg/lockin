import { describe, expect, it } from "vitest";
import { presignUrl } from "./s3-presign";

const keys = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };

describe("presignUrl", () => {
  it("matches the worked example in the AWS Signature V4 docs", () => {
    const url = new URL(
      presignUrl({
        ...keys,
        method: "GET",
        endpoint: "https://examplebucket.s3.amazonaws.com",
        path: "/test.txt",
        region: "us-east-1",
        expiresSec: 86400,
        now: new Date("2013-05-24T00:00:00Z"),
      }),
    );
    expect(url.searchParams.get("X-Amz-Signature")).toBe("aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });

  it("signs the headers it was given", () => {
    const url = new URL(
      presignUrl({
        ...keys,
        method: "PUT",
        endpoint: "https://x.r2.cloudflarestorage.com",
        path: "/bucket/avatars/u1/a.webp",
        region: "auto",
        expiresSec: 600,
        now: new Date("2026-11-04T00:00:00Z"),
        headers: { "Content-Type": "image/webp" },
      }),
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(url.pathname).toBe("/bucket/avatars/u1/a.webp");
  });
});
