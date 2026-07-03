-- Weighted search vector for meetings: title (A) > goal (B) > summary (C).
ALTER TABLE "Meeting" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("goal", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("summary", '')), 'C')
  ) STORED;

ALTER TABLE "Transcript" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("fullText", ''))) STORED;

ALTER TABLE "Task" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("description", '') || ' ' || coalesce("assigneeText", ''))
  ) STORED;

CREATE INDEX "Meeting_searchVector_idx" ON "Meeting" USING GIN ("searchVector");
CREATE INDEX "Transcript_searchVector_idx" ON "Transcript" USING GIN ("searchVector");
CREATE INDEX "Task_searchVector_idx" ON "Task" USING GIN ("searchVector");
