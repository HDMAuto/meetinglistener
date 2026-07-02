import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AuthResponse,
  Meeting,
  Notification,
  Task,
  Transcript,
  User,
} from "./types";

// Production backend (Cloudflare Tunnel) by default so installed builds work
// anywhere. For local development, set EXPO_PUBLIC_API_URL in mobile/.env
// (e.g. http://localhost:3000 for the iOS simulator, or your Mac's LAN IP for
// a physical phone).
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "https://meetings-api.hdmauto.app";

const TOKEN_KEY = "ml_token";
let cachedToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
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
  const headers = new Headers(opts.headers);
  if (cachedToken) headers.set("Authorization", `Bearer ${cachedToken}`);
  if (opts.body && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
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
  register: (body: { name: string; email: string; password: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  listUsers: () => request<User[]>("/users"),

  listMeetings: () => request<Meeting[]>("/meetings"),
  getMeeting: (id: string) => request<Meeting>(`/meetings/${id}`),
  createMeeting: (title: string) =>
    request<Meeting>("/meetings", { method: "POST", body: JSON.stringify({ title }) }),
  getTranscript: (id: string) => request<Transcript>(`/meetings/${id}/transcript`),
  deleteMeeting: (id: string) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  uploadAudio: (id: string, fileUri: string) => {
    const form = new FormData();
    // React Native FormData file part: { uri, name, type }
    form.append("audio", {
      uri: fileUri,
      name: "recording.m4a",
      type: "audio/m4a",
    } as unknown as Blob);
    return request<Meeting>(`/meetings/${id}/audio`, { method: "POST", body: form });
  },

  listTasks: (meetingId: string) => request<Task[]>(`/meetings/${meetingId}/tasks`),
  assignTask: (taskId: string, assigneeId: string) =>
    request<Task>(`/tasks/${taskId}/assign`, {
      method: "POST",
      body: JSON.stringify({ assigneeId }),
    }),
  completeTask: (taskId: string) =>
    request<Task>(`/tasks/${taskId}/complete`, { method: "POST" }),

  listNotifications: () => request<Notification[]>("/notifications"),
  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "POST" }),
};
