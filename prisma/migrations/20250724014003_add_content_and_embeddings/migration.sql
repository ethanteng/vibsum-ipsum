-- CreateTable
CREATE TABLE "MailchimpContent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "embedding" BYTEA NOT NULL,

    CONSTRAINT "MailchimpContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntercomContent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "embedding" BYTEA NOT NULL,

    CONSTRAINT "IntercomContent_pkey" PRIMARY KEY ("id")
);
