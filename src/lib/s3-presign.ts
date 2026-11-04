import { createHash, createHmac } from "node:crypto";

type Presign = {
  method: "GET" | "PUT" | "DELETE";
  endpoint: string; // e.g. https://<account>.r2.cloudflarestorage.com
  path: string; // /bucket/key
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSec: number;
  now: Date;
  headers?: Record<string, string>; // signed, so the client must send exactly these
};

const encode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

/** AWS Signature V4 query signing, which S3 and R2 both accept. Saves pulling in the AWS SDK for one request type. */
export function presignUrl(p: Presign): string {
  const url = new URL(p.endpoint);
  const stamp = p.now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const date = stamp.slice(0, 8);
  const scope = `${date}/${p.region}/s3/aws4_request`;

  const headers: Record<string, string> = { host: url.host };
  for (const [k, v] of Object.entries(p.headers ?? {})) headers[k.toLowerCase()] = v;
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(";");

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${p.accessKeyId}/${scope}`,
    "X-Amz-Date": stamp,
    "X-Amz-Expires": String(p.expiresSec),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const queryString = Object.keys(query)
    .sort()
    .map((k) => `${encode(k)}=${encode(query[k])}`)
    .join("&");

  const canonicalPath = p.path.split("/").map(encode).join("/");
  const canonicalHeaders = names.map((n) => `${n}:${headers[n].trim()}\n`).join("");
  const request = [p.method, canonicalPath, queryString, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");

  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, createHash("sha256").update(request).digest("hex")].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${p.secretAccessKey}`, date), p.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");

  return `${url.origin}${canonicalPath}?${queryString}&X-Amz-Signature=${signature}`;
}
