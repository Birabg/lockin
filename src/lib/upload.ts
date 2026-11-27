import { requestUpload } from "@/app/actions/media";
import type { UploadKind } from "@/lib/storage";

/** Sends a blob straight to storage and returns its key. */
export async function uploadBlob(kind: UploadKind, blob: Blob): Promise<string> {
  const ticket = await requestUpload(kind, blob.type, blob.size);
  if ("error" in ticket) throw new Error(ticket.error);
  const res = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: blob });
  if (!res.ok) throw new Error("Upload failed");
  return ticket.key;
}

/** Centre-crops an image to a wide strip for a profile banner (4:1), small enough to upload quickly. */
export async function bannerImage(file: File, width = 1200, height = 300): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const w = width / scale;
  const h = height / scale;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, (bitmap.width - w) / 2, (bitmap.height - h) / 2, w, h, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.85),
  );
}

/** Centre-crops an image to a small square, so avatars stay tiny without a server-side image library. */
export async function squareImage(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d")?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.85),
  );
}
