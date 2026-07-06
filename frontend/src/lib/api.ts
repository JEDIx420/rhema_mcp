import { getStoredEnglishTranslation } from "@/lib/englishTranslations";

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5050";

export function getApiBase() {
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  return window.localStorage.getItem("rhelo-api-base") || DEFAULT_API_BASE;
}

export function setApiBase(value: string) {
  const normalized = value.trim().replace(/\/$/, "");
  if (typeof window !== "undefined") {
    window.localStorage.setItem("rhelo-api-base", normalized || DEFAULT_API_BASE);
  }
  return normalized || DEFAULT_API_BASE;
}

const apiUrl = (path: string) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${getApiBase()}${path}${separator}translation=${getStoredEnglishTranslation()}`;
};

export async function fetchChapter(book: string, chapter: number) {
  const res = await fetch(apiUrl(`/api/read?book=${book}&chapter=${chapter}`));
  if (!res.ok) throw new Error("Failed to fetch chapter");
  return res.json();
}

export async function searchScriptures(
  query: string,
  filters?: { book?: string; testament?: string; sort?: string; page?: number; limit?: number }
) {
  const params = new URLSearchParams({ q: query });
  if (filters?.book) params.set("book", filters.book);
  if (filters?.testament) params.set("testament", filters.testament);
  if (filters?.sort) params.set("sort", filters.sort);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  const res = await fetch(apiUrl(`/api/search?${params}`));
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}

export async function fetchVerseDetails(verseId: string) {
  const res = await fetch(apiUrl(`/api/verse?id=${verseId}`));
  if (!res.ok) throw new Error("Failed to fetch verse details");
  return res.json();
}

export async function searchLexicon(query: string) {
  const res = await fetch(apiUrl(`/api/lexicon?q=${query}`));
  if (!res.ok) throw new Error("Failed to search lexicon");
  return res.json();
}

export async function searchTopics(query: string) {
  const res = await fetch(apiUrl(`/api/topics?q=${query}`));
  if (!res.ok) throw new Error("Failed to search topics");
  return res.json();
}

export async function fetchBiography(personId: string) {
  const res = await fetch(apiUrl(`/api/biography?id=${personId}`));
  if (!res.ok) throw new Error("Failed to fetch biography");
  return res.json();
}

export async function fetchChapterMap(book: string, chapter: number) {
  const res = await fetch(apiUrl(`/api/chapter_map?book=${book}&chapter=${chapter}`));
  if (!res.ok) throw new Error("Failed to fetch map data");
  return res.json();
}

export async function fetchTimeline() {
  const res = await fetch(apiUrl(`/api/timeline`));
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function lookupLexicon(word: string) {
  const res = await fetch(apiUrl(`/api/lexicon/lookup?q=${encodeURIComponent(word)}`));
  if (!res.ok) throw new Error("Failed to lookup word");
  return res.json();
}

export async function fetchOccurrences(lemma: string) {
  const res = await fetch(apiUrl(`/api/lexicon/occurrences?lemma=${encodeURIComponent(lemma)}`));
  if (!res.ok) throw new Error("Failed to fetch occurrences");
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(apiUrl(`/api/stats`));
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchGeographyRoutes() {
  const res = await fetch(apiUrl(`/api/geography/routes`));
  if (!res.ok) throw new Error("Failed to fetch geography routes");
  return res.json();
}

export async function fetchRoutePoints(routeId: string) {
  const res = await fetch(apiUrl(`/api/geography/routes/points?route_id=${routeId}`));
  if (!res.ok) throw new Error("Failed to fetch route points");
  return res.json();
}

export async function fetchSessions() {
  const res = await fetch(apiUrl(`/api/sessions`));
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function createSession(title: string, content: string) {
  const res = await fetch(apiUrl(`/api/sessions/create`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content })
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function updateSession(sessionId: string, title: string, content: string) {
  const res = await fetch(apiUrl(`/api/sessions/update`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, title, content })
  });
  if (!res.ok) throw new Error("Failed to update session");
  return res.json();
}

export async function deleteSession(sessionId: string) {
  const res = await fetch(apiUrl(`/api/sessions/delete`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId })
  });
  if (!res.ok) throw new Error("Failed to delete session");
  return res.json();
}

export async function searchSessions(query: string) {
  const res = await fetch(apiUrl(`/api/sessions/search?q=${encodeURIComponent(query)}`));
  if (!res.ok) throw new Error("Failed to search sessions");
  return res.json();
}

export async function generateSessionPDF(sessionId: string, title: string, content: string) {
  const res = await fetch(apiUrl(`/api/sessions/pdf`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, title, content })
  });
  if (!res.ok) throw new Error("Failed to compile session PDF");
  return res.json();
}

export interface McpStatus {
  status: "connected" | "disconnected";
  server: string;
  transport: "stdio";
  api_url: string;
  database: string;
  tools: string[];
  capabilities: Record<"web" | "tauri", string[]>;
}

export async function fetchMcpStatus(): Promise<McpStatus> {
  const res = await fetch(apiUrl("/api/mcp/status"));
  if (!res.ok) throw new Error("Failed to connect to the Rhelo MCP service");
  return res.json();
}

export async function fetchMcpConfig(): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl("/api/mcp/config"));
  if (!res.ok) throw new Error("Failed to load MCP configuration");
  const data = await res.json();
  return data.configuration;
}
