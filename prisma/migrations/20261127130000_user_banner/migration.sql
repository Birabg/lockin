-- AlterTable: an optional profile banner, a built-in one (/banners/…) or an upload
ALTER TABLE "User" ADD COLUMN     "banner" TEXT;
