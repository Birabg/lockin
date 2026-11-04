import { readLocalFile } from "@/lib/storage";

const TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
  webm: "video/webm",
  mp4: "video/mp4",
};

/** Serves locally stored uploads in dev. In production files come straight from S3_PUBLIC_URL. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const type = TYPES[key.split(".").at(-1) ?? ""];
  const file = type ? await readLocalFile(key) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
