-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastIngestedAt" TIMESTAMP(3),
ALTER COLUMN "password" DROP NOT NULL;
