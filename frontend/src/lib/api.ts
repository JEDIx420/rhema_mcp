import { getStoredEnglishTranslation } from "@/lib/englishTranslations";

const WEB_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5050";

const isTauriRuntime = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const invokeDesktop = async <T>(command: string, args: Record<string, unknown> = {}) => {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
};

export function getApiBase() {
  if (typeof window === "undefined") return WEB_API_BASE;
  if (isTauriRuntime()) return WEB_API_BASE;
  const stored = window.localStorage.getItem("rhelo-api-base");
  return stored || WEB_API_BASE;
}

export function setApiBase(value: string) {
  if (isTauriRuntime()) return WEB_API_BASE;
  const normalized = value.trim().replace(/\/$/, "");
  if (typeof window !== "undefined") {
    window.localStorage.setItem("rhelo-api-base", normalized || WEB_API_BASE);
  }
  return normalized || WEB_API_BASE;
}

const apiUrl = (path: string) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${getApiBase()}${path}${separator}translation=${getStoredEnglishTranslation()}`;
};

const fetchRhelo = async (input: RequestInfo | URL, init?: RequestInit) => {
  const isReadRequest = !init?.method || init.method.toUpperCase() === "GET";
  const isDesktop = isTauriRuntime();
  const attempts = isReadRequest && isDesktop ? 12 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await globalThis.fetch(input, isReadRequest ? { ...init, cache: "no-store" } : init);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Rhelo backend is unavailable");
};

export async function fetchChapter(book: string, chapter: number) {
  const res = await fetchRhelo(apiUrl(`/api/read?book=${book}&chapter=${chapter}`));
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

  const res = await fetchRhelo(apiUrl(`/api/search?${params}`));
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}

export async function fetchVerseDetails(verseId: string) {
  const res = await fetchRhelo(apiUrl(`/api/verse?id=${verseId}`));
  if (!res.ok) throw new Error("Failed to fetch verse details");
  return res.json();
}

export async function searchLexicon(query: string) {
  const res = await fetchRhelo(apiUrl(`/api/lexicon?q=${query}`));
  if (!res.ok) throw new Error("Failed to search lexicon");
  return res.json();
}

export async function searchTopics(query: string) {
  const res = await fetchRhelo(apiUrl(`/api/topics?q=${query}`));
  if (!res.ok) throw new Error("Failed to search topics");
  return res.json();
}

export async function fetchBiography(personId: string) {
  const res = await fetchRhelo(apiUrl(`/api/biography?id=${personId}`));
  if (!res.ok) throw new Error("Failed to fetch biography");
  return res.json();
}

export async function fetchChapterMap(book: string, chapter: number) {
  const res = await fetchRhelo(apiUrl(`/api/chapter_map?book=${book}&chapter=${chapter}`));
  if (!res.ok) throw new Error("Failed to fetch map data");
  return res.json();
}

export async function fetchTimeline() {
  const res = await fetchRhelo(apiUrl(`/api/timeline`));
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function lookupLexicon(word: string) {
  const res = await fetchRhelo(apiUrl(`/api/lexicon/lookup?q=${encodeURIComponent(word)}`));
  if (!res.ok) throw new Error("Failed to lookup word");
  return res.json();
}

export async function fetchOccurrences(lemma: string) {
  const res = await fetchRhelo(apiUrl(`/api/lexicon/occurrences?lemma=${encodeURIComponent(lemma)}`));
  if (!res.ok) throw new Error("Failed to fetch occurrences");
  return res.json();
}

export async function fetchStats() {
  const res = await fetchRhelo(apiUrl(`/api/stats`));
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchGeographyRoutes() {
  const res = await fetchRhelo(apiUrl(`/api/geography/routes`));
  if (!res.ok) throw new Error("Failed to fetch geography routes");
  return res.json();
}

export async function fetchRoutePoints(routeId: string) {
  const res = await fetchRhelo(apiUrl(`/api/geography/routes/points?route_id=${routeId}`));
  if (!res.ok) throw new Error("Failed to fetch route points");
  return res.json();
}

export async function fetchSessions() {
  if (isTauriRuntime()) {
    return invokeDesktop<{ sessions: Array<Record<string, unknown>> }>("fetch_sessions");
  }
  const res = await fetchRhelo(apiUrl(`/api/sessions`));
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function createSession(title: string, content: string) {
  if (isTauriRuntime()) {
    return invokeDesktop<{ status: string; session_id: string; title: string; content: string }>(
      "create_session",
      { title, content },
    );
  }
  const res = await fetchRhelo(apiUrl(`/api/sessions/create`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content })
  });
  if (!res.ok) throw new Error(`Failed to create session: ${await res.text()}`);
  return res.json();
}

export async function updateSession(sessionId: string, title: string, content: string) {
  if (isTauriRuntime()) {
    return invokeDesktop<{ status: string; session: Record<string, unknown> }>("update_session", {
      sessionId,
      title,
      content,
    });
  }
  const res = await fetchRhelo(apiUrl(`/api/sessions/update`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, title, content })
  });
  if (!res.ok) throw new Error(`Failed to update session: ${await res.text()}`);
  return res.json();
}

export async function deleteSession(sessionId: string) {
  if (isTauriRuntime()) {
    return invokeDesktop<{ status: string; session_id: string }>("delete_session", { sessionId });
  }
  const res = await fetchRhelo(apiUrl(`/api/sessions/delete`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId })
  });
  if (!res.ok) throw new Error(`Failed to delete session: ${await res.text()}`);
  return res.json();
}

export async function searchSessions(query: string) {
  const res = await fetchRhelo(apiUrl(`/api/sessions/search?q=${encodeURIComponent(query)}`));
  if (!res.ok) throw new Error("Failed to search sessions");
  return res.json();
}

export async function generateSessionPDF(sessionId: string, title: string, content: string) {
  const res = await fetchRhelo(apiUrl(`/api/sessions/pdf`), {
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
  const res = await fetchRhelo(apiUrl("/api/mcp/status"));
  if (!res.ok) throw new Error("Failed to connect to the Rhelo MCP service");
  return res.json();
}

export async function fetchMcpConfig(): Promise<Record<string, unknown>> {
  const res = await fetchRhelo(apiUrl("/api/mcp/config"));
  if (!res.ok) throw new Error("Failed to load MCP configuration");
  const data = await res.json();
  return data.configuration;
}
