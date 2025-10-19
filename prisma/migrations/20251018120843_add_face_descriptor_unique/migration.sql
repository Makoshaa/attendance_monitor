/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `FaceDescriptor` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "FaceDescriptor_userId_key" ON "FaceDescriptor"("userId");
