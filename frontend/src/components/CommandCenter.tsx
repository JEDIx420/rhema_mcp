"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Terminal, BookOpen, BookMarked, Users, Command } from "lucide-react";
import { searchScriptures, searchLexicon, fetchBiography } from "@/lib/api";
import { BIBLE_BOOKS, getBookName } from "@/lib/books";

interface CommandCenterProps {
  onNavigate: (book: string, chapter: number, verse?: number) => void;
  onSelectPerson: (personId: string) => void;
  onViewChange: (view: string) => void;
}

export default function CommandCenter({
  onNavigate,
  onSelectPerson,
  onViewChange,
}: CommandCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle Command Center on Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setInputVal("");
      setResults([]);
    }
  }, [isOpen]);

  // Handle typing and query parsing
  useEffect(() => {
    if (!inputVal.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (inputVal.startsWith("/find ")) {
          const query = inputVal.substring(6).trim();
          if (query) {
            const data = await searchScriptures(query);
            setResults((data.results || []).map((r: any) => ({ ...r, type: "find" })));
          }
        } else if (inputVal.startsWith("/dict ")) {
          const query = inputVal.substring(6).trim();
          if (query) {
            const data = await searchLexicon(query);
            const merged = [
              ...(data.lexicon || []).map((l: any) => ({ ...l, type: "lexicon" })),
              ...(data.dictionary || []).map((d: any) => ({ ...d, type: "dictionary" })),
            ];
            setResults(merged.slice(0, 10));
          }
        } else if (inputVal.startsWith("/bio ")) {
          const query = inputVal.substring(5).trim();
          if (query) {
            const data = await fetchBiography(query).catch(() => null);
            if (data && data.profile) {
              setResults([{ ...data.profile, type: "bio" }]);
            } else {
              setResults([]);
            }
          }
        } else if (inputVal.startsWith("/read ")) {
          const parts = inputVal.substring(6).trim().split(" ");
          const searchBook = parts[0].toUpperCase();
          const matchedBooks = BIBLE_BOOKS.filter(
            (b) =>
              b.code.startsWith(searchBook) ||
              b.name.toLowerCase().startsWith(searchBook.toLowerCase())
          );
          setResults(
            matchedBooks.map((b) => ({
              ...b,
              type: "read",
              chapter: parseInt(parts[1]) || 1,
            }))
          );
        } else {
          // General matching on books or command suggestions
          const matchedBooks = BIBLE_BOOKS.filter((b) =>
            b.name.toLowerCase().startsWith(inputVal.toLowerCase())
          );
          setResults(
            matchedBooks.map((b) => ({
              ...b,
              type: "read",
              chapter: 1,
            }))
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputVal]);

  const handleSelectResult = (item: any) => {
    if (item.type === "read") {
      onNavigate(item.code, item.chapter);
      onViewChange("read");
      setIsOpen(false);
    } else if (item.type === "find") {
      onNavigate(item.book, item.chapter, item.verse);
      onViewChange("read");
      setIsOpen(false);
    } else if (item.type === "bio") {
      onSelectPerson(item.id);
      onViewChange("people");
      setIsOpen(false);
    } else if (item.type === "lexicon" || item.type === "dictionary") {
      onViewChange("dictionary");
      setIsOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/60"
            style={{ backdropFilter: "blur(8px)" }}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-2xl rounded-2xl border overflow-hidden shadow-2xl flex flex-col max-h-[500px]"
            style={{
              background: "var(--bg-popover)",
              borderColor: "var(--border-subtle)",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.12)",
              backdropFilter: "var(--glass-blur)",
            }}
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <Command size={18} style={{ color: "var(--primary)" }} />
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Type a command (/read, /find, /dict, /bio) or Bible book..."
                className="flex-1 bg-transparent border-none outline-none text-sm"
                style={{ color: "var(--text-primary)" }}
              />
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg-surface-elevated)", color: "var(--text-muted)" }}>
                ESC to close
              </span>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-2">
              {/* Empty state suggestions */}
              {!inputVal.trim() && (
                <div className="p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                    Supported Commands
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setInputVal("/read GEN 1")}
                      className="flex items-center justify-between w-full p-2.5 rounded-xl text-left text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen size={16} className="text-blue-600 group-hover:scale-105 transition-transform" />
                        <span>/read [Book] [Chapter]</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Go to Genesis 1</span>
                    </button>
                    <button
                      onClick={() => setInputVal("/find covenant")}
                      className="flex items-center justify-between w-full p-2.5 rounded-xl text-left text-sm hover:bg-sky-50 hover:text-sky-600 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Search size={16} className="text-sky-600 group-hover:scale-105 transition-transform" />
                        <span>/find [Query]</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>FTS English Search</span>
                    </button>
                    <button
                      onClick={() => setInputVal("/dict grace")}
                      className="flex items-center justify-between w-full p-2.5 rounded-xl text-left text-sm hover:bg-purple-50 hover:text-purple-600 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <BookMarked size={16} className="text-purple-600 group-hover:scale-105 transition-transform" />
                        <span>/dict [Term]</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Easton & Strongs Lexicon</span>
                    </button>
                    <button
                      onClick={() => setInputVal("/bio Abraham_1")}
                      className="flex items-center justify-between w-full p-2.5 rounded-xl text-left text-sm hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-indigo-600 group-hover:scale-105 transition-transform" />
                        <span>/bio [Name]</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Genealogy bio and family tree</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {loading && (
                <div className="flex items-center justify-center p-8 gap-2" style={{ color: "var(--text-muted)" }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Terminal size={18} />
                  </motion.div>
                  <span className="text-xs">Searching database...</span>
                </div>
              )}

              {/* Results List */}
              {!loading && results.length > 0 && (
                <div className="space-y-1">
                  {results.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectResult(item)}
                      className="flex items-start justify-between w-full p-2.5 rounded-xl text-left text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="flex-1 pr-4">
                        {item.type === "read" && (
                          <div className="flex items-center gap-2">
                            <BookOpen size={14} className="text-blue-500 shrink-0" />
                            <span className="font-semibold">{item.name} {item.chapter}</span>
                            <span className="text-xs px-1.5 py-0.2 rounded" style={{ background: "rgba(37, 99, 235, 0.08)", color: "var(--primary)" }}>
                              {item.testament}
                            </span>
                          </div>
                        )}
                        {item.type === "find" && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Search size={14} className="text-sky-400 shrink-0" />
                              <span className="text-xs px-1.5 py-0.2 rounded" style={{ background: "rgba(56, 189, 248, 0.12)", color: "var(--secondary)" }}>
                                {item.id}
                              </span>
                              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                                {getBookName(item.book)} {item.chapter}:{item.verse}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-left truncate" style={{ color: "var(--text-primary)" }}>
                              {item.text_en}
                            </p>
                          </div>
                        )}
                        {item.type === "lexicon" && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <BookMarked size={14} className="text-purple-400 shrink-0" />
                              <span className="text-xs px-1.5 py-0.2 rounded" style={{ background: "rgba(167, 139, 250, 0.12)", color: "var(--accent)" }}>
                                {item.strongs_id}
                              </span>
                              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                {item.lemma}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-left truncate" style={{ color: "var(--text-muted)" }}>
                              {item.definition}
                            </p>
                          </div>
                        )}
                        {item.type === "dictionary" && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <BookMarked size={14} className="text-purple-400 shrink-0" />
                              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                {item.name}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-left truncate" style={{ color: "var(--text-muted)" }}>
                              {item.definition_text}
                            </p>
                          </div>
                        )}
                        {item.type === "bio" && (
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-indigo-400 shrink-0" />
                            <span className="font-semibold">{item.name}</span>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              ({item.sex}, {item.tribe || "No tribe"})
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] uppercase font-bold shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--primary)" }}>
                        Select ↵
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* No results state */}
              {!loading && inputVal.trim() && results.length === 0 && (
                <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>
                  No matching commands or search results found.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
