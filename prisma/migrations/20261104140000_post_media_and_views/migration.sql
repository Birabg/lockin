-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "mediaType" TEXT,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- Keep existing timelapses
UPDATE "Post" SET "mediaUrl" = "timelapseUrl", "mediaType" = 'timelapse' WHERE "timelapseUrl" IS NOT NULL;

ALTER TABLE "Post" DROP COLUMN "timelapseUrl";

-- CreateTable
CREATE TABLE "PostView" (
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("postId","userId","day")
);

-- CreateIndex
CREATE INDEX "PostView_day_idx" ON "PostView"("day");

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
