import { prisma } from "../db/client.js";

const LIMIT = 5;

// ts_headline sentinels: control characters that cannot occur in transcript
// text, so the frontend can convert them to highlight elements without ever
// interpreting transcript content as markup.
export const HIGHLIGHT_START = "\u0001";
export const HIGHLIGHT_END = "\u0002";

const HEADLINE_OPTS = `StartSel=${HIGHLIGHT_START},StopSel=${HIGHLIGHT_END},MaxWords=25,MinWords=10`;

export interface MeetingHit {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  rank: number;
}

export interface TranscriptHit {
  meetingId: string;
  meetingTitle: string;
  snippet: string;
  rank: number;
}

export interface TaskHit {
  id: string;
  meetingId: string;
  meetingTitle: string;
  description: string;
  status: string;
  assigneeName: string | null;
  rank: number;
}

export interface SearchResults {
  query: string;
  meetings: MeetingHit[];
  transcripts: TranscriptHit[];
  tasks: TaskHit[];
}

export async function search(ownerId: string, query: string): Promise<SearchResults> {
  const [meetings, transcripts, tasks] = await Promise.all([
    prisma.$queryRaw<MeetingHit[]>`
      SELECT m."id", m."title", m."status", m."createdAt",
             ts_rank(m."searchVector", websearch_to_tsquery('english', ${query}))::float8 AS "rank"
      FROM "Meeting" m
      WHERE m."ownerId" = ${ownerId}
        AND m."searchVector" @@ websearch_to_tsquery('english', ${query})
      ORDER BY "rank" DESC, m."createdAt" DESC
      LIMIT ${LIMIT}
    `,
    prisma.$queryRaw<TranscriptHit[]>`
      SELECT t."meetingId",
             m."title" AS "meetingTitle",
             ts_headline('english', t."fullText",
                         websearch_to_tsquery('english', ${query}),
                         ${HEADLINE_OPTS}) AS "snippet",
             ts_rank(t."searchVector", websearch_to_tsquery('english', ${query}))::float8 AS "rank"
      FROM "Transcript" t
      JOIN "Meeting" m ON m."id" = t."meetingId"
      WHERE m."ownerId" = ${ownerId}
        AND t."searchVector" @@ websearch_to_tsquery('english', ${query})
      ORDER BY "rank" DESC
      LIMIT ${LIMIT}
    `,
    prisma.$queryRaw<TaskHit[]>`
      SELECT k."id", k."meetingId",
             m."title" AS "meetingTitle",
             k."description", k."status",
             u."name" AS "assigneeName",
             ts_rank(k."searchVector", websearch_to_tsquery('english', ${query}))::float8 AS "rank"
      FROM "Task" k
      JOIN "Meeting" m ON m."id" = k."meetingId"
      LEFT JOIN "User" u ON u."id" = k."assigneeId"
      WHERE m."ownerId" = ${ownerId}
        AND k."searchVector" @@ websearch_to_tsquery('english', ${query})
      ORDER BY "rank" DESC
      LIMIT ${LIMIT}
    `,
  ]);

  return { query, meetings, transcripts, tasks };
}
