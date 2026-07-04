"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, Loader2, BookOpen, Navigation } from "lucide-react";
import { searchScriptures } from "@/lib/api";
import { getBookName } from "@/lib/books";

interface SearchResult {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text_en: string;
}

interface SearchViewProps {
  onNavigate?: (book: string, chapter: number, verse?: number) => void;
  onViewChange?: (view: string) => void;
}

export default function SearchView({ onNavigate, onViewChange }: SearchViewProps) {
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

  const handleJumpToVerse = (r: SearchResult) => {
    if (onNavigate && onViewChange) {
      onNavigate(r.book, r.chapter, r.verse);
      onViewChange("read");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Search Header */}
      <div className="h-16 px-6 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 font-sans">
          Search Scriptures
        </h2>
      </div>

      {/* Search Query Area */}
      <div className="p-8 border-b border-slate-200 shrink-0 bg-slate-50 flex justify-center">
        <form onSubmit={handleSearch} className="w-full max-w-2xl">
          <div className="relative flex items-center bg-white rounded-xl shadow-sm border border-slate-300 transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <SearchIcon
              size={22}
              className="absolute left-5 pointer-events-none text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Search words or phrases (e.g., "covenant", "love")...'
              className="w-full pl-14 pr-32 py-4 bg-transparent border-none outline-none text-lg text-slate-900 placeholder-slate-400 rounded-xl font-sans"
            />
            <button
              type="submit"
              className="absolute right-3 px-6 py-2.5 rounded-xl text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs cursor-pointer font-sans"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Results viewport */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-500 text-sm">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <span>Executing scriptural FTS5 query...</span>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-sans">
            <SearchIcon size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-base">No results found for &quot;{query}&quot;</p>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-24 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4 border border-blue-100">
              <SearchIcon size={24} className="text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1.5 font-sans">Full-Text Scripture Search</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed font-sans">
              Execute lightning-fast full-text searches across both Testaments using our FTS5 virtual index.
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="max-w-4xl space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
              Search Results ({results.length})
            </div>
            <div className="flex flex-col gap-4">
              {results.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="p-5 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-5 transition-all duration-200 hover:border-blue-200 hover:shadow-md group"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {r.id}
                      </span>
                      <span className="text-sm font-semibold text-slate-500 font-sans">
                        {getBookName(r.book)} {r.chapter}:{r.verse}
                      </span>
                    </div>
                    <p className="text-[17px] leading-relaxed text-slate-700 pr-4 font-prose">
                      {r.text_en}
                    </p>
                  </div>

                  <button
                    onClick={() => handleJumpToVerse(r)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 cursor-pointer self-center"
                    title="Jump to reading desk"
                  >
                    <Navigation size={16} />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
