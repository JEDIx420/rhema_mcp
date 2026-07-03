"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, Loader2, BookOpen } from "lucide-react";
import { searchScriptures } from "@/lib/api";
import { getBookName } from "@/lib/books";

interface SearchResult {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text_en: string;
}

export default function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchScriptures(query);
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Header */}
      <div
        className="px-6 py-5 border-b shrink-0"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <h2
          className="text-xl font-bold mb-4"
          style={{ fontFamily: "var(--font-outfit), sans-serif" }}
        >
          Search Scriptures
        </h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search words or phrases (e.g. "covenant", "love one another")'
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border outline-none transition-colors"
              style={{
                background: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{ background: "var(--primary)", color: "var(--bg-base)" }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
            <SearchIcon size={48} className="mx-auto mb-4 opacity-30" />
            <p>No results found for &quot;{query}&quot;</p>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
            <BookOpen size={56} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg mb-1">Full-Text Scripture Search</p>
            <p className="text-sm">Search across the entire Bible using keywords or phrases.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              {results.length} result{results.length !== 1 ? "s" : ""} for &quot;{query}&quot;
            </p>
            <div className="space-y-2">
              {results.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl border transition-colors"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(52, 211, 153, 0.12)", color: "var(--primary)" }}>
                      {r.id}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {getBookName(r.book)} {r.chapter}:{r.verse}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {r.text_en}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
