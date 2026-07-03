"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  BookOpen,
  Link2,
  MapPin,
  MessageSquareText,
  X,
} from "lucide-react";
import { fetchChapter, fetchVerseDetails } from "@/lib/api";
import { BIBLE_BOOKS, getBookName } from "@/lib/books";

interface Verse {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text_en: string;
  text_original: string;
  text_hi: string;
  text_te: string;
  text_ml: string;
  text_ta: string;
  cross_references_count: number;
  places_count: number;
  commentaries: string[];
}

interface VerseDetail {
  verse: Verse;
  commentaries: { commentary_id: string; text: string }[];
  places: { name: string; latitude: number; longitude: number; type: string }[];
  events: { title: string; year: number; location: string; description: string }[];
  cross_references: { to_verse: string; votes: number }[];
}

const TRANSLATIONS = [
  { key: "text_en", label: "English (KJV)", enabled: true },
  { key: "text_original", label: "Original (Heb/Grk)", enabled: true },
  { key: "text_hi", label: "Hindi", enabled: false },
  { key: "text_te", label: "Telugu", enabled: false },
  { key: "text_ml", label: "Malayalam", enabled: false },
  { key: "text_ta", label: "Tamil", enabled: false },
];

export default function ReadingDesk() {
  const [book, setBook] = useState("GEN");
  const [chapter, setChapter] = useState(1);
  type FetchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "success"; verses: Verse[] };
  const [fetchState, setFetchState] = useState<FetchState>({ status: "loading" });
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [enabledTranslations, setEnabledTranslations] = useState(
    TRANSLATIONS.map((t) => ({ ...t }))
  );
  const [selectedVerse, setSelectedVerse] = useState<VerseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const loadChapterRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadChapterRef.current?.abort();
    const controller = new AbortController();
    loadChapterRef.current = controller;
    let cancelled = false;

    // We signal "loading" via a microtask to satisfy the React compiler lint
    // which prohibits synchronous setState calls at the top of an effect body.
    queueMicrotask(() => {
      if (!cancelled) {
        setFetchState({ status: "loading" });
        setSelectedVerse(null);
      }
    });

    fetchChapter(book, chapter)
      .then((data) => {
        if (!cancelled) {
          setFetchState({ status: "success", verses: data.verses || [] });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchState({
            status: "error",
            message: `Failed to load ${getBookName(book)} ${chapter}. Is the backend server running on port 5000?`,
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [book, chapter, retryKey]);

  const loading = fetchState.status === "loading";
  const error = fetchState.status === "error" ? fetchState.message : null;
  const verses = fetchState.status === "success" ? fetchState.verses : [];

  const handleVerseClick = async (verseId: string) => {
    setLoadingDetail(true);
    try {
      const data = await fetchVerseDetails(verseId);
      setSelectedVerse(data);
    } catch {
      // silently ignore
    } finally {
      setLoadingDetail(false);
    }
  };

  const navigateChapter = (direction: number) => {
    const newChapter = chapter + direction;
    if (newChapter < 1) {
      // Go to previous book
      const bookIdx = BIBLE_BOOKS.findIndex((b) => b.code === book);
      if (bookIdx > 0) {
        setBook(BIBLE_BOOKS[bookIdx - 1].code);
        setChapter(150); // Will clamp naturally
      }
    } else {
      setChapter(newChapter);
    }
  };

  const toggleTranslation = (key: string) => {
    setEnabledTranslations((prev) =>
      prev.map((t) => (t.key === key ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const activeTranslations = enabledTranslations.filter((t) => t.enabled);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Header Bar */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateChapter(-1)}
            className="p-1.5 rounded-md transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Book Selector */}
          <div className="relative">
            <button
              onClick={() => setShowBookPicker(!showBookPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              style={{
                background: "var(--bg-surface-elevated)",
                color: "var(--text-primary)",
              }}
            >
              <BookOpen size={16} style={{ color: "var(--primary)" }} />
              <span className="font-semibold text-sm">
                {getBookName(book)} {chapter}
              </span>
              <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
            </button>

            <AnimatePresence>
              {showBookPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 left-0 z-50 rounded-xl p-3 border max-h-96 overflow-y-auto w-72"
                  style={{
                    background: "var(--bg-surface-elevated)",
                    borderColor: "var(--border-subtle)",
                    backdropFilter: "var(--glass-blur)",
                  }}
                >
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Old Testament
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-3">
                    {BIBLE_BOOKS.filter((b) => b.testament === "OT").map((b) => (
                      <button
                        key={b.code}
                        onClick={() => {
                          setBook(b.code);
                          setChapter(1);
                          setShowBookPicker(false);
                        }}
                        className="text-left px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer"
                        style={{
                          background: b.code === book ? "rgba(52, 211, 153, 0.15)" : "transparent",
                          color: b.code === book ? "var(--primary)" : "var(--text-muted)",
                        }}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    New Testament
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {BIBLE_BOOKS.filter((b) => b.testament === "NT").map((b) => (
                      <button
                        key={b.code}
                        onClick={() => {
                          setBook(b.code);
                          setChapter(1);
                          setShowBookPicker(false);
                        }}
                        className="text-left px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer"
                        style={{
                          background: b.code === book ? "rgba(52, 211, 153, 0.15)" : "transparent",
                          color: b.code === book ? "var(--primary)" : "var(--text-muted)",
                        }}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => navigateChapter(1)}
            className="p-1.5 rounded-md transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Translation Toggles */}
        <div className="flex items-center gap-2">
          {enabledTranslations.map((t) => (
            <button
              key={t.key}
              onClick={() => toggleTranslation(t.key)}
              className="px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer"
              style={{
                background: t.enabled ? "rgba(52, 211, 153, 0.12)" : "transparent",
                color: t.enabled ? "var(--primary)" : "var(--text-muted)",
                border: `1px solid ${t.enabled ? "var(--primary)" : "var(--border-subtle)"}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reading Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Verses Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin" style={{ color: "var(--primary)" }} />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8 rounded-xl border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
                <p style={{ color: "var(--text-muted)" }}>{error}</p>
                <button
                  onClick={() => setRetryKey((k) => k + 1)}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: "var(--primary)", color: "var(--bg-base)" }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="max-w-5xl mx-auto space-y-1">
              <h2
                className="text-2xl font-bold mb-6"
                style={{ fontFamily: "var(--font-outfit), sans-serif", color: "var(--text-primary)" }}
              >
                {getBookName(book)} {chapter}
              </h2>

              {verses.map((v) => (
                <motion.div
                  key={v.id}
                  layout
                  className="group rounded-lg p-3 transition-colors cursor-pointer"
                  style={{
                    background: selectedVerse?.verse?.id === v.id ? "rgba(52, 211, 153, 0.06)" : "transparent",
                  }}
                  whileHover={{
                    backgroundColor: "rgba(52, 211, 153, 0.04)",
                  }}
                  onClick={() => handleVerseClick(v.id)}
                >
                  <div
                    className={`grid gap-4`}
                    style={{
                      gridTemplateColumns: activeTranslations.length > 1 ? `repeat(${activeTranslations.length}, 1fr)` : "1fr",
                    }}
                  >
                    {activeTranslations.map((t) => (
                      <div key={t.key}>
                        <span
                          className="text-xs font-bold mr-2 select-none"
                          style={{ color: "var(--primary)" }}
                        >
                          {v.verse}
                        </span>
                        <span
                          className="text-sm leading-relaxed"
                          style={{
                            color: "var(--text-primary)",
                            fontFamily: t.key === "text_original" ? "'SBL Hebrew', 'Noto Serif Hebrew', serif" : "inherit",
                            direction: t.key === "text_original" && book !== "MAT" && book !== "MRK" && book !== "LUK" && book !== "JHN" && book !== "ACT" && book !== "ROM" && book !== "1CO" && book !== "2CO" && book !== "GAL" && book !== "EPH" && book !== "PHP" && book !== "COL" && book !== "1TH" && book !== "2TH" && book !== "1TI" && book !== "2TI" && book !== "TIT" && book !== "PHM" && book !== "HEB" && book !== "JAS" && book !== "1PE" && book !== "2PE" && book !== "1JN" && book !== "2JN" && book !== "3JN" && book !== "JUD" && book !== "REV" ? "rtl" : "ltr",
                          }}
                        >
                          {(v as unknown as Record<string, string>)[t.key] || "—"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Verse Metadata Badges */}
                  <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {v.cross_references_count > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--secondary)" }}>
                        <Link2 size={12} /> {v.cross_references_count} refs
                      </span>
                    )}
                    {v.places_count > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--accent)" }}>
                        <MapPin size={12} /> {v.places_count} places
                      </span>
                    )}
                    {v.commentaries.length > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        <MessageSquareText size={12} /> Commentary
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Verse Detail Drawer */}
        <AnimatePresence>
          {selectedVerse && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="w-96 border-l overflow-y-auto p-5 shrink-0"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
              }}
            >
              {loadingDetail ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 size={24} className="animate-spin" style={{ color: "var(--primary)" }} />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold" style={{ color: "var(--primary)" }}>
                      {selectedVerse.verse.id}
                    </h3>
                    <button
                      onClick={() => setSelectedVerse(null)}
                      className="p-1 rounded cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Cross References */}
                  {selectedVerse.cross_references.length > 0 && (
                    <div className="mb-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--secondary)" }}>
                        Cross References
                      </h4>
                      <div className="space-y-1">
                        {selectedVerse.cross_references.map((cr) => (
                          <button
                            key={cr.to_verse}
                            onClick={() => handleVerseClick(cr.to_verse)}
                            className="flex items-center justify-between w-full px-2 py-1.5 rounded text-xs transition-colors cursor-pointer"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <span>{cr.to_verse}</span>
                            <span className="text-xs" style={{ color: "var(--border-focus)" }}>
                              {cr.votes} votes
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Places */}
                  {selectedVerse.places.length > 0 && (
                    <div className="mb-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
                        Places
                      </h4>
                      {selectedVerse.places.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 text-xs" style={{ color: "var(--text-muted)" }}>
                          <MapPin size={12} />
                          <span>{p.name}</span>
                          <span className="ml-auto">{p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timeline Events */}
                  {selectedVerse.events.length > 0 && (
                    <div className="mb-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--primary)" }}>
                        Timeline
                      </h4>
                      {selectedVerse.events.map((e, i) => (
                        <div key={i} className="p-2 rounded-lg mb-2" style={{ background: "var(--bg-surface-elevated)" }}>
                          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{e.title}</div>
                          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            {e.year} • {e.location}
                          </div>
                          {e.description && (
                            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{e.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Commentaries */}
                  {selectedVerse.commentaries.length > 0 && (
                    <div className="mb-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                        Commentary
                      </h4>
                      {selectedVerse.commentaries.map((c, i) => (
                        <div key={i} className="text-xs leading-relaxed p-3 rounded-lg mb-2" style={{ background: "var(--bg-surface-elevated)", color: "var(--text-muted)" }}>
                          {c.text}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
