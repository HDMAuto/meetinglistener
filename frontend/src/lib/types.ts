export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type MeetingStatus =
  | "recording"
  | "uploaded"
  | "transcribing"
  | "summarizing"
  | "ready"
  | "failed";

export interface Meeting {
  id: string;
  ownerId: string;
  title: string;
  status: MeetingStatus;
  audioUrl: string | null;
  durationSec: number | null;
  goal: string | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export type TaskStatus = "needs_assignee" | "open" | "done";

export interface Task {
  id: string;
  meetingId: string;
  description: string;
  assigneeId: string | null;
  assigneeText: string | null;
  suggestedAssigneeIds: string[];
  status: TaskStatus;
  notifiedAt: string | null;
  createdAt: string;
}

export interface Utterance {
  speaker: string;
  text: string;
}

export interface Transcript {
  id: string;
  meetingId: string;
  fullText: string;
  segments: Utterance[] | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  taskId: string;
  meetingId: string;
  read: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SearchMeetingHit {
  id: string;
  title: string;
  status: MeetingStatus;
  createdAt: string;
  rank: number;
}

export interface SearchTranscriptHit {
  meetingId: string;
  meetingTitle: string;
  snippet: string;
  rank: number;
}

export interface SearchTaskHit {
  id: string;
  meetingId: string;
  meetingTitle: string;
  description: string;
  status: TaskStatus;
  assigneeName: string | null;
  rank: number;
}

export interface SearchResults {
  query: string;
  meetings: SearchMeetingHit[];
  transcripts: SearchTranscriptHit[];
  tasks: SearchTaskHit[];
}
