/*
  Warnings:

  - A unique constraint covering the columns `[contentId]` on the table `IntercomContent` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "IntercomContent_contentId_key" ON "IntercomContent"("contentId");
