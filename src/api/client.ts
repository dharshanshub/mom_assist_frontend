const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_KEY = "mom_rag_token";

// ── Auth helpers ──────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Central fetch wrapper — injects Authorization header and fires a global
 *  "auth:unauthorized" event on 401 so AuthContext can redirect to login. */
async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("auth:unauthorized"));
  }
  return response;
}

export async function loginUser(
  username: string,
  password: string,
): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? "Login failed");
  }
  const data = await response.json() as { access_token: string };
  return data.access_token;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export type MeetingType =
  | "Standup"
  | "Planning"
  | "Review"
  | "Retrospective"
  | "Client"
  | "Board"
  | "All-Hands"
  | "One-on-One"
  | "Other";

export interface MeetingMatch {
  id: string;
  title: string;
  meeting_type: MeetingType;
  date: string;
  organizer: string;
  attendees: string[];
  topics: string[];
  decisions: string[];
  action_items: string[];
  score: number;
  summary: string | null;
  /** Blob filename stored in Pinecone. Null for legacy seeded meetings. */
  blob_filename: string | null;
}

export interface SearchResponse {
  query: string;
  answer: string;
  meetings: MeetingMatch[];
  request_id: string;
}

export interface ApiError {
  error_code: string;
  message: string;
  path: string;
  method: string;
  request_id: string;
}

export interface ExtractedProject {
  project_name: string;
  project_id: string;
  status: string;
  recommendation: string;
  decision: string;
  budget_allocation: string;
  action_items: string[];
}

export interface ExtractedMeeting {
  meeting_type: string;
  date: string;
  time: string;
  organizer: string;
  location: string;
  projects: ExtractedProject[];
}

export interface UploadResponse {
  /** Generated at upload time — shared key for Blob Storage and Pinecone. */
  meeting_id: string;
  blob_filename: string;
  extracted: ExtractedMeeting;
  raw_text: string;
}

export interface IndexResponse {
  meeting_id: string;
  chunks_indexed: number;
  message: string;
}

/** Callbacks for the streaming search response. */
export interface StreamCallbacks {
  onMeetings: (meetings: MeetingMatch[]) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * Agentic streaming search. Sends query + conversation history to the agent
 * endpoint and fires callbacks as SSE events arrive.
 *
 * Event order: onMeetings? → onDelta* → onDone  (or onError on failure)
 */
export async function searchMeetingsStream(
  query: string,
  history: ConversationMessage[],
  callbacks: StreamCallbacks,
  topK?: number,
): Promise<void> {
  let response: Response;
  try {
    response = await apiFetch(`${BASE_URL}/api/v1/search/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, messages: history, top_k: topK ?? null }),
    });
  } catch {
    callbacks.onError("Network error — could not reach the server.");
    return;
  }

  if (!response.ok) {
    try {
      const err: ApiError = await response.json();
      callbacks.onError(err.message ?? "Search failed.");
    } catch {
      callbacks.onError(`Server error (${response.status}).`);
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("Streaming not supported by the server.");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const event = JSON.parse(raw) as { type: string; [key: string]: unknown };
          if (event.type === "meetings") callbacks.onMeetings(event.data as MeetingMatch[]);
          else if (event.type === "delta") callbacks.onDelta(event.content as string);
          else if (event.type === "done") callbacks.onDone();
          else if (event.type === "error") callbacks.onError(event.message as string);
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Knowledge base dashboard API ──────────────────────────────────────────────
//
// Architecture: two separate endpoints replace the old single GET /knowledge-base
//   GET /knowledge-base/stats          — cached 5 min server-side; call once on mount
//   GET /knowledge-base/meetings       — cursor-paginated, 20 records/page, O(1) per call
//
// The dashboard calls both in parallel on mount, then uses cursor-stack navigation.

export interface MeetingRecord {
  meeting_id: string;
  title: string;
  meeting_type: string;
  date: string;
  organizer: string;
  attendees: string[];
  topics: string[];
  decisions: string[];
  action_items: string[];
  blob_filename: string | null;
  indexed_at: string;
}

export interface KnowledgeBaseStats {
  total_meetings: number;
  type_distribution: Record<string, number>;
  avg_attendees: number;
  last_added_at: string | null;
  top_topics: string[];
  meetings_by_month: Record<string, number>;
  top_organizers: string[];
  top_attendees: string[];
  is_sampled: boolean;
}

export interface MeetingsPageResponse {
  meetings: MeetingRecord[];
  /** Opaque cursor for the next page. null = last page. */
  next_cursor: string | null;
  /** Total meeting count from stats cache. -1 = not yet computed. */
  total: number;
}

export async function getKnowledgeBaseStats(): Promise<KnowledgeBaseStats> {
  const response = await apiFetch(`${BASE_URL}/api/v1/knowledge-base/stats`);
  if (!response.ok) {
    const err: ApiError = await response.json();
    throw new Error(err.message ?? "Failed to load knowledge base stats");
  }
  return response.json() as Promise<KnowledgeBaseStats>;
}

export async function listMeetingsPage(
  cursor?: string | null,
  limit = 20,
  search?: string,
  meetingType?: string,
): Promise<MeetingsPageResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  if (search) params.set("search", search);
  if (meetingType && meetingType !== "All") params.set("meeting_type", meetingType);
  const response = await apiFetch(`${BASE_URL}/api/v1/knowledge-base/meetings?${params}`);
  if (!response.ok) {
    const err: ApiError = await response.json();
    throw new Error(err.message ?? "Failed to load meetings");
  }
  return response.json() as Promise<MeetingsPageResponse>;
}

export async function getDocumentUrl(meetingId: string): Promise<string> {
  const response = await apiFetch(`${BASE_URL}/api/v1/knowledge-base/${meetingId}/document`);
  if (!response.ok) {
    const err: ApiError = await response.json();
    throw new Error(err.message ?? "Could not retrieve document URL");
  }
  const data = await response.json() as { url: string; expires_in: number };
  return data.url;
}

export async function deleteMeeting(meetingId: string): Promise<void> {
  const response = await apiFetch(`${BASE_URL}/api/v1/knowledge-base/${meetingId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const err: ApiError = await response.json();
    throw new Error(err.message ?? "Delete failed");
  }
}

export async function uploadMinutes(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiFetch(`${BASE_URL}/api/v1/meetings/upload`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const err: ApiError = await response.json();
    throw new Error(err.message ?? "Upload failed");
  }
  return response.json() as Promise<UploadResponse>;
}

// ── Project History Tracker ───────────────────────────────────────────────────

export interface ProjectRecord {
  document_name: string;
  meeting_date: string;
  meeting_time: string;
  meeting_type: string;
  organizer: string;
  project_name: string;
  project_id: string;
  status: string;
  recommendation: string;
  decision: string;
  budget_allocation: string;
  action_items: string[];
}

export interface ProjectHistoryCallbacks {
  onRecords: (records: ProjectRecord[]) => void;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

// ── Project Dashboard ─────────────────────────────────────────────────────────

export interface DashboardProject {
  project_id: string;
  project_name: string;
  status: string;
  category: string;
  latest_date: string;
  first_date: string;
  latest_decision: string;
  appearance_count: number;
  is_stale: boolean;
  status_change_count: number;
  has_decision: boolean;
  latest_budget: string;
  total_action_items: number;
}

export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  on_hold_projects: number;
  completed_projects: number;
  at_risk_projects: number;
  total_meetings: number;
  total_decisions: number;
  // Health metrics
  stale_projects: number;
  churn_projects: number;
  no_decision_projects: number;
  avg_project_age_days: number;
  action_item_density: number;
  total_budget_raw: number;
  budget_by_status: Record<string, number>;
  // Charts
  meeting_type_distribution: Record<string, number>;
  meetings_by_month: Record<string, number>;
  top_projects: { project_id: string; project_name: string; count: number }[];
  recent_meetings: { document_name: string; meeting_date: string; meeting_time: string; meeting_type: string; project_count: number }[];
  all_projects: DashboardProject[];
}

export interface MeetingFileRecord {
  document_name: string;
  meeting_id: string;
  meeting_date: string;
  meeting_time: string;
  meeting_type: string;
  organizer: string;
  project_names: string[];
}

export interface MeetingFilesResponse {
  meetings: MeetingFileRecord[];
  total: number;
  page: number;
  total_pages: number;
}

export async function deleteMeetingFile(documentName: string): Promise<void> {
  const response = await apiFetch(
    `${BASE_URL}/api/v1/projects/meetings/${encodeURIComponent(documentName)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const err: ApiError = await response.json().catch(() => ({ message: "Delete failed" } as ApiError));
    throw new Error(err.message ?? "Delete failed");
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiFetch(`${BASE_URL}/api/v1/projects/dashboard-stats`);
  if (!response.ok) throw new Error("Failed to load dashboard stats");
  return response.json() as Promise<DashboardStats>;
}

export async function listMeetingFiles(
  q = "",
  page = 1,
  limit = 5,
): Promise<MeetingFilesResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set("q", q);
  const response = await apiFetch(`${BASE_URL}/api/v1/projects/meetings?${params}`);
  if (!response.ok) throw new Error("Failed to load meetings");
  return response.json() as Promise<MeetingFilesResponse>;
}

export async function suggestProjectIds(q: string): Promise<string[]> {
  const params = new URLSearchParams({ q });
  const response = await apiFetch(`${BASE_URL}/api/v1/projects/suggest?${params}`);
  if (!response.ok) return [];
  return response.json() as Promise<string[]>;
}

export async function streamProjectHistory(
  projectId: string,
  callbacks: ProjectHistoryCallbacks,
): Promise<void> {
  let response: Response;
  try {
    response = await apiFetch(`${BASE_URL}/api/v1/projects/history/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
  } catch {
    callbacks.onError("Network error — could not reach the server.");
    return;
  }

  if (!response.ok) {
    try {
      const err: ApiError = await response.json();
      callbacks.onError(err.message ?? "Request failed.");
    } catch {
      callbacks.onError(`Server error (${response.status}).`);
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) { callbacks.onError("Streaming not supported."); return; }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const event = JSON.parse(raw) as { type: string; [key: string]: unknown };
          if (event.type === "records") callbacks.onRecords(event.data as ProjectRecord[]);
          else if (event.type === "delta") callbacks.onDelta(event.content as string);
          else if (event.type === "done") callbacks.onDone();
          else if (event.type === "error") callbacks.onError(event.message as string);
        } catch { /* ignore malformed lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function indexMeeting(
  meetingId: string,
  blobFilename: string,
  meeting: ExtractedMeeting,
  rawText: string,
): Promise<IndexResponse> {
  const response = await apiFetch(`${BASE_URL}/api/v1/meetings/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      meeting_id:    meetingId,
      blob_filename: blobFilename,
      meeting,
      raw_text:      rawText,
    }),
  });
  if (!response.ok) {
    const err: ApiError = await response.json();
    throw new Error(err.message ?? "Indexing failed");
  }
  return response.json() as Promise<IndexResponse>;
}
