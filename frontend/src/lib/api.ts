import type {
  AuthResponse,
  ManagedUser,
  Meeting,
  Notification,
  SearchResults,
  Task,
  Transcript,
  User,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TOKEN_KEY = "ml_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(opts.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (opts.body && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const code = data?.error as string | undefined;
    throw new ApiError(res.status, code ?? `Request failed (${res.status})`, code);
  }
  return data as T;
}

export const api = {
  // Auth
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<void>("/auth/change-password", { method: "POST", body: JSON.stringify(body) }),

  // Users
  listUsers: () => request<User[]>("/users"),
  listAllUsers: () => request<ManagedUser[]>("/users/all"),
  createUser: (body: { name: string; email: string; role: "admin" | "member"; tempPassword: string }) =>
    request<ManagedUser>("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; email?: string; role?: "admin" | "member" }) =>
    request<ManagedUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deactivateUser: (id: string) =>
    request<ManagedUser>(`/users/${id}/deactivate`, { method: "POST" }),
  reactivateUser: (id: string) =>
    request<ManagedUser>(`/users/${id}/reactivate`, { method: "POST" }),
  resetUserPassword: (id: string, tempPassword: string) =>
    request<ManagedUser>(`/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ tempPassword }),
    }),

  // Meetings
  listMeetings: () => request<Meeting[]>("/meetings"),
  getMeeting: (id: string) => request<Meeting>(`/meetings/${id}`),
  createMeeting: (title: string) =>
    request<Meeting>("/meetings", { method: "POST", body: JSON.stringify({ title }) }),
  getTranscript: (id: string) => request<Transcript>(`/meetings/${id}/transcript`),
  deleteMeeting: (id: string) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  uploadAudio: (id: string, file: Blob, filename: string) => {
    const form = new FormData();
    form.append("audio", file, filename);
    return request<Meeting>(`/meetings/${id}/audio`, { method: "POST", body: form });
  },

  // Search
  search: (q: string) =>
    request<SearchResults>(`/search?q=${encodeURIComponent(q)}`),

  // Tasks
  listTasks: (meetingId: string) => request<Task[]>(`/meetings/${meetingId}/tasks`),
  assignTask: (taskId: string, assigneeId: string) =>
    request<Task>(`/tasks/${taskId}/assign`, {
      method: "POST",
      body: JSON.stringify({ assigneeId }),
    }),
  completeTask: (taskId: string) =>
    request<Task>(`/tasks/${taskId}/complete`, { method: "POST" }),

  // Notifications
  listNotifications: () => request<Notification[]>("/notifications"),
  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "POST" }),
};
