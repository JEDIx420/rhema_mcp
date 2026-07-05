"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, Loader2, Navigation, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { searchScriptures } from "@/lib/api";
import { BIBLE_BOOKS, getBookName } from "@/lib/books";
import StudyPane from "./StudyPane";

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
  const [total, setTotal] = useState(0);
  const [book, setBook] = useState("ALL");
  const [testament, setTestament] = useState("ALL");
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [availableBooks, setAvailableBooks] = useState<string[]>([]);
  const [availableTestaments, setAvailableTestaments] = useState<string[]>([]);

  const handleDragStart = (e: React.DragEvent, verseId: string, verseText: string) => {
    e.dataTransfer.setData("text/plain", verseText);
    e.dataTransfer.setData("application/verse-id", verseId);
    e.dataTransfer.effectAllowed = "copy";
    const dragEvent = new CustomEvent("targum-drag-start", { detail: { verseId, verseText } });
    window.dispatchEvent(dragEvent);
  };

  const handleDragEnd = () => {
    const dragEvent = new CustomEvent("targum-drag-end");
    window.dispatchEvent(dragEvent);
  };

  const limit = 50;

  const triggerSearch = async (
    searchQuery: string,
    filters: { book: string; testament: string; sort: string; page: number }
  ) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchScriptures(searchQuery, {
        book: filters.book,
        testament: filters.testament,
        sort: filters.sort,
        page: filters.page,
        limit
      });
      setResults(data.results || []);
      setTotal(data.total || 0);
      setAvailableBooks(data.matching_books || []);
      setAvailableTestaments(data.matching_testaments || []);
    } catch {
      setResults([]);
      setTotal(0);
      setAvailableBooks([]);
      setAvailableTestaments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = customQuery !== undefined ? customQuery : query;
    setPage(1);
    setSelectedVerseId(null);
    setBook("ALL");
    setTestament("ALL");
    triggerSearch(searchQuery, { book: "ALL", testament: "ALL", sort, page: 1 });
  };

  const handleFilterChange = (updates: { book?: string; testament?: string; sort?: string }) => {
    const nextBook = updates.book !== undefined ? updates.book : book;
    const nextTestament = updates.testament !== undefined ? updates.testament : testament;
    const nextSort = updates.sort !== undefined ? updates.sort : sort;

    setBook(nextBook);
    setTestament(nextTestament);
    setSort(nextSort);
    setPage(1);

    triggerSearch(query, { book: nextBook, testament: nextTestament, sort: nextSort, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    triggerSearch(query, { book, testament, sort, page: newPage });
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setPage(1);
    setSelectedVerseId(null);
    setBook("ALL");
    setTestament("ALL");
    triggerSearch(suggestion, { book: "ALL", testament: "ALL", sort, page: 1 });
  };

  const handleClear = () => {
    setSearched(false);
    setQuery("");
    setResults([]);
    setTotal(0);
    setBook("ALL");
    setTestament("ALL");
    setSort("relevance");
    setPage(1);
    setSelectedVerseId(null);
    setAvailableBooks([]);
    setAvailableTestaments([]);
  };

  const handleJumpToReadingDesk = (r: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting the card
    if (onNavigate && onViewChange) {
      onNavigate(r.book, r.chapter, r.verse);
      onViewChange("read");
    }
  };

  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, total);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* Left Column: Search & Results */}
      <div className="col-span-1 md:col-span-5 border-r border-slate-200 bg-slate-55 flex flex-col h-full overflow-hidden">
        {/* Search Input Box */}
        <div className="p-6 border-b border-slate-200 bg-white shrink-0">
          <form onSubmit={(e) => handleSearch(e)} className="relative w-full">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search words or phrases (e.g., covenant, love)..."
              className="w-full h-14 bg-white rounded-xl border border-slate-300 shadow-sm pl-4 pr-24 text-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-sans"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center cursor-pointer font-sans text-sm"
            >
              Search
            </button>
          </form>
        </div>

        {/* Filter Row */}
        {searched && (
          <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <select
                value={testament}
                onChange={(e) => handleFilterChange({ testament: e.target.value })}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors cursor-pointer outline-none font-sans"
              >
                <option value="ALL">All Testaments</option>
                {availableTestaments.includes("OT") && <option value="OT">Old Testament</option>}
                {availableTestaments.includes("NT") && <option value="NT">New Testament</option>}
              </select>

              <select
                value={book}
                onChange={(e) => handleFilterChange({ book: e.target.value })}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors cursor-pointer outline-none font-sans max-w-[120px]"
              >
                <option value="ALL">All Books</option>
                {BIBLE_BOOKS.filter((b) => availableBooks.includes(b.code.toUpperCase())).map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => handleFilterChange({ sort: e.target.value })}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors cursor-pointer outline-none font-sans"
              >
                <option value="relevance">Relevance</option>
                <option value="canonical">Chronological</option>
              </select>
            </div>

            <button
              onClick={handleClear}
              className="text-sm text-slate-500 hover:text-slate-800 font-medium cursor-pointer font-sans shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-500 text-sm font-sans">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <span>Searching scriptural index...</span>
            </div>
          )}

          {!loading && !searched && (
            <div className="py-12 px-6">
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 font-sans text-center">
                Suggested Searches
              </h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Love one another", "Covenant", "David", "Grace"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:border-slate-300 hover:shadow-sm cursor-pointer transition-all font-sans text-sm font-medium"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="text-center py-20 text-slate-450 font-sans">
              <SearchIcon size={40} className="mx-auto mb-3 opacity-20 text-slate-400" />
              <p className="text-sm text-slate-500">No results found for &quot;{query}&quot;</p>
              <button
                onClick={handleClear}
                className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}

          {!loading && results.length > 0 && (
            <>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 py-1 font-sans">
                Search Results ({total})
              </div>
              <div className="space-y-3">
                {results.map((r, i) => {
                  const isSelected = selectedVerseId === r.id;
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.015, 0.2) }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, r.id, r.text_en)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedVerseId(r.id)}
                      className={`p-4 rounded-xl border transition-all flex flex-col gap-2 text-left select-none cursor-grab active:cursor-grabbing ${
                        isSelected
                          ? "ring-2 ring-blue-500 bg-blue-50/30 border-blue-400"
                          : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {r.id}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 font-sans">
                            {getBookName(r.book)} {r.chapter}:{r.verse}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleJumpToReadingDesk(r, e)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Jump to reading desk"
                        >
                          <Navigation size={13} />
                        </button>
                      </div>
                      <p className="text-[15px] leading-relaxed text-slate-700 font-prose pr-2">
                        {r.text_en}
                      </p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="py-4 border-t border-slate-200 flex flex-col gap-3 items-center justify-between font-sans text-xs">
                  <span className="text-slate-500">
                    Showing <span className="font-semibold text-slate-900">{startIndex}-{endIndex}</span> of{" "}
                    <span className="font-semibold text-slate-900">{total}</span> results
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => handlePageChange(page - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft size={12} />
                      Prev
                    </button>
                    <span className="text-slate-600">
                      {page} / {totalPages}
                    </span>
                    <button
                      disabled={page === totalPages}
                      onClick={() => handlePageChange(page + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all"
                    >
                      Next
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Column: Dynamic Study Pane */}
      <div className="col-span-1 md:col-span-7 bg-white flex flex-col h-full overflow-hidden">
        {selectedVerseId ? (
          <StudyPane
            verseId={selectedVerseId}
            onVerseClick={(id) => setSelectedVerseId(id)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 font-sans h-full">
            <BookOpen size={48} className="text-slate-300 mb-4 stroke-[1.5]" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">Bible Exegesis Engine</h3>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
              Select a verse to view detailed exegesis, commentaries, cross-references, and word-level original language lexicons.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
