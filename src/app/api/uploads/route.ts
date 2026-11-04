import { readLocalTicket, writeLocalFile } from "@/lib/storage";

/** Local-disk stand-in for a presigned S3 upload. The token says exactly what may be written. */
export async function PUT(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ticket = await readLocalTicket(token).catch(() => null);
  if (!ticket) return new Response("Bad or expired upload ticket", { status: 403 });
  if (req.headers.get("content-type") !== ticket.contentType) return new Response("Wrong file type", { status: 415 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength !== ticket.size) return new Response("Wrong file size", { status: 413 });

  await writeLocalFile(ticket.key, bytes);
  return new Response(null, { status: 204 });
}
