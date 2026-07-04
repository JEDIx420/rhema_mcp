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
}: {
  onNavigate: (book: string, chapter: number, verse?: number) => void;
  onSelectPerson: (personId: string) => void;
  onViewChange: (view: string) => void;
}) {
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
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl flex flex-col max-h-[550px] z-10"
          >
            {/* Input Header */}
            <div className="flex items-center gap-3.5 px-5 py-4 border-b border-slate-200 bg-slate-50/50">
              <Command size={20} className="text-blue-600" />
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Type a command (/read, /find, /dict, /bio) or Bible book..."
                className="flex-1 bg-transparent border-none outline-none text-lg font-sans text-slate-900 placeholder-slate-400"
              />
              <span className="text-xs px-2.5 py-1 rounded bg-slate-100 font-sans text-slate-500 font-medium">
                ESC to close
              </span>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Empty state suggestions */}
              {!inputVal.trim() && (
                <div className="p-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 font-sans">
                    Supported Commands
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setInputVal("/read GEN 1")}
                      className="flex items-center justify-between w-full p-3.5 rounded-xl text-left text-base hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer group font-sans text-slate-700"
                    >
                      <div className="flex items-center gap-3.5">
                        <BookOpen size={18} className="text-blue-600 group-hover:scale-105 transition-transform" />
                        <span>/read [Book] [Chapter]</span>
                      </div>
                      <span className="text-xs text-slate-450">Go to Genesis 1</span>
                    </button>
                    <button
                      onClick={() => setInputVal("/find covenant")}
                      className="flex items-center justify-between w-full p-3.5 rounded-xl text-left text-base hover:bg-sky-50 hover:text-sky-600 transition-colors cursor-pointer group font-sans text-slate-700"
                    >
                      <div className="flex items-center gap-3.5">
                        <Search size={18} className="text-sky-600 group-hover:scale-105 transition-transform" />
                        <span>/find [Query]</span>
                      </div>
                      <span className="text-xs text-slate-450">FTS English Search</span>
                    </button>
                    <button
                      onClick={() => setInputVal("/dict grace")}
                      className="flex items-center justify-between w-full p-3.5 rounded-xl text-left text-base hover:bg-purple-50 hover:text-purple-600 transition-colors cursor-pointer group font-sans text-slate-700"
                    >
                      <div className="flex items-center gap-3.5">
                        <BookMarked size={18} className="text-purple-600 group-hover:scale-105 transition-transform" />
                        <span>/dict [Term]</span>
                      </div>
                      <span className="text-xs text-slate-450">Easton & Strongs Lexicon</span>
                    </button>
                    <button
                      onClick={() => setInputVal("/bio Abraham_1")}
                      className="flex items-center justify-between w-full p-3.5 rounded-xl text-left text-base hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer group font-sans text-slate-700"
                    >
                      <div className="flex items-center gap-3.5">
                        <Users size={18} className="text-indigo-600 group-hover:scale-105 transition-transform" />
                        <span>/bio [Name]</span>
                      </div>
                      <span className="text-xs text-slate-450">Genealogy bio and family tree</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {loading && (
                <div className="flex items-center justify-center p-8 gap-2.5 text-slate-500 font-sans">
                  <Terminal size={18} className="animate-pulse" />
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
                      className="flex items-start justify-between w-full p-3.5 rounded-xl text-left text-base hover:bg-slate-50 transition-colors cursor-pointer group font-sans"
                    >
                      <div className="flex-1 pr-4 min-w-0">
                        {item.type === "read" && (
                          <div className="flex items-center gap-2">
                            <BookOpen size={16} className="text-blue-500 shrink-0" />
                            <span className="font-semibold text-slate-900">{item.name} {item.chapter}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono">
                              {item.testament}
                            </span>
                          </div>
                        )}
                        {item.type === "find" && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Search size={16} className="text-sky-500 shrink-0" />
                              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                                {item.id}
                              </span>
                              <span className="text-sm font-semibold text-slate-500">
                                {getBookName(item.book)} {item.chapter}:{item.verse}
                              </span>
                            </div>
                            <p className="text-base leading-relaxed text-slate-700 pr-4 line-clamp-2 font-prose">
                              {item.text_en}
                            </p>
                          </div>
                        )}
                        {item.type === "lexicon" && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <BookMarked size={16} className="text-purple-500 shrink-0" />
                              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                {item.strongs_id}
                              </span>
                              <span className="text-base font-bold text-slate-900 font-sans">
                                {item.lemma}
                              </span>
                            </div>
                            <p className="text-base leading-relaxed text-slate-750 pr-4 line-clamp-2 font-prose">
                              {item.definition}
                            </p>
                          </div>
                        )}
                        {item.type === "dictionary" && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <BookMarked size={16} className="text-purple-500 shrink-0" />
                              <span className="text-base font-bold text-slate-900 font-sans">
                                {item.name}
                              </span>
                            </div>
                            <p className="text-base leading-relaxed text-slate-750 pr-4 line-clamp-2 font-prose">
                              {item.definition_text}
                            </p>
                          </div>
                        )}
                        {item.type === "bio" && (
                          <div className="flex items-center gap-2">
                            <Users size={16} className="text-indigo-500 shrink-0" />
                            <span className="font-semibold text-slate-900">{item.name}</span>
                            <span className="text-xs text-slate-500 font-sans">
                              ({item.sex}, {item.tribe || "No tribe"})
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs uppercase font-bold shrink-0 self-center opacity-0 group-hover:opacity-100 transition-all font-sans text-blue-600">
                        Select ↵
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* No results state */}
              {!loading && inputVal.trim() && results.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-500 font-sans">
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
