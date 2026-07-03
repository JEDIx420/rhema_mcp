const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";

export async function fetchChapter(book: string, chapter: number) {
  const res = await fetch(`${API_BASE}/api/read?book=${book}&chapter=${chapter}`);
  if (!res.ok) throw new Error("Failed to fetch chapter");
  return res.json();
}

export async function searchScriptures(query: string, book?: string) {
  const params = new URLSearchParams({ q: query });
  if (book) params.set("book", book);
  const res = await fetch(`${API_BASE}/api/search?${params}`);
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}

export async function fetchVerseDetails(verseId: string) {
  const res = await fetch(`${API_BASE}/api/verse?id=${verseId}`);
  if (!res.ok) throw new Error("Failed to fetch verse details");
  return res.json();
}

export async function searchLexicon(query: string) {
  const res = await fetch(`${API_BASE}/api/lexicon?q=${query}`);
  if (!res.ok) throw new Error("Failed to search lexicon");
  return res.json();
}

export async function searchTopics(query: string) {
  const res = await fetch(`${API_BASE}/api/topics?q=${query}`);
  if (!res.ok) throw new Error("Failed to search topics");
  return res.json();
}

export async function fetchBiography(personId: string) {
  const res = await fetch(`${API_BASE}/api/biography?id=${personId}`);
  if (!res.ok) throw new Error("Failed to fetch biography");
  return res.json();
}

export async function fetchChapterMap(book: string, chapter: number) {
  const res = await fetch(`${API_BASE}/api/chapter_map?book=${book}&chapter=${chapter}`);
  if (!res.ok) throw new Error("Failed to fetch map data");
  return res.json();
}

export async function fetchTimeline() {
  const res = await fetch(`${API_BASE}/api/timeline`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function lookupLexicon(word: string) {
  const res = await fetch(`${API_BASE}/api/lexicon/lookup?q=${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error("Failed to lookup word");
  return res.json();
}

export async function fetchOccurrences(lemma: string) {
  const res = await fetch(`${API_BASE}/api/lexicon/occurrences?lemma=${encodeURIComponent(lemma)}`);
  if (!res.ok) throw new Error("Failed to fetch occurrences");
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}
