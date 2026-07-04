export type Role = "admin" | "member";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  // Optional: absent in user objects persisted to localStorage before this release.
  role?: Role;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

// Full row for the admin User Management table (GET /users/all).
export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
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
  teamId: string | null;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMember[];
}

// Shape embedded on GET /meetings/:id
export interface MeetingTeam {
  id: string;
  name: string;
  members: { id: string; name: string }[];
}

export interface MeetingWithTeam extends Meeting {
  team: MeetingTeam | null;
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
