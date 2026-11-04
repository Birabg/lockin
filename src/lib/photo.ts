import "server-only";
import sharp from "sharp";

const MAX_SIDE = 1600;

/** Rejects anything that doesn't decode as an image. Metadata such as GPS location is dropped by default. */
export function resizePhoto(input: Uint8Array): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 100_000_000 })
    .rotate() // apply the camera's orientation before that metadata goes
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
