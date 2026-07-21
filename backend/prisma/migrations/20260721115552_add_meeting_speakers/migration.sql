-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assigneeSpeakerLabel" TEXT;

-- CreateTable
CREATE TABLE "MeetingSpeaker" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'unknown',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingSpeaker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingSpeaker_meetingId_idx" ON "MeetingSpeaker"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingSpeaker_userId_idx" ON "MeetingSpeaker"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingSpeaker_meetingId_label_key" ON "MeetingSpeaker"("meetingId", "label");

-- AddForeignKey
ALTER TABLE "MeetingSpeaker" ADD CONSTRAINT "MeetingSpeaker_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSpeaker" ADD CONSTRAINT "MeetingSpeaker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
