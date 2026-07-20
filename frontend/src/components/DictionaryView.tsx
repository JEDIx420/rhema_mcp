"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  BookMarked,
  BookOpen,
  Loader2,
  Search,
  UserRound,
  Volume2,
} from "lucide-react";
import {
  fetchDictionaryStudy,
  searchLexicon,
  searchTopics,
  type BibleNameEntry,
  type DictionaryEntry,
  type DictionaryStudyKind,
  type DictionaryStudyResponse,
  type LexiconEntry,
  type TopicEntry,
} from "@/lib/api";
import { setGlassDragImage } from "@/lib/drag";
import { invokeSpeech, isTtsRecoveryError } from "@/lib/speech";
import StudyPane from "./StudyPane";

interface DictionarySelection {
  kind: DictionaryStudyKind;
  id: string;
}

const dictionarySourceName = (source: string) => {
  if (source === "EAS") return "Easton's Bible Dictionary";
  if (source === "SMI") return "Smith's Bible Dictionary";
  return source;
};

export default function DictionaryView() {
  const [query, setQuery] = useState("");
  const [lexiconResults, setLexiconResults] = useState<LexiconEntry[]>([]);
  const [dictionaryResults, setDictionaryResults] = useState<DictionaryEntry[]>([]);
  const [topicResults, setTopicResults] = useState<TopicEntry[]>([]);
  const [nameResults, setNameResults] = useState<BibleNameEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [selection, setSelection] = useState<DictionarySelection | null>(null);
  const [studyDetails, setStudyDetails] = useState<DictionaryStudyResponse | null>(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const studyRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const requestId = ++studyRequestRef.current;
    if (!selection) return;
    fetchDictionaryStudy(selection.kind, selection.id)
      .then((details) => {
        if (studyRequestRef.current === requestId) {
          if (process.env.NODE_ENV === "development") {
            console.debug(
              `[Dictionary] loaded kind=${details.kind} id=${details.id} relatedVerses=${details.related_verses.length}`
            );
          }
          setStudyDetails(details);
        }
      })
      .catch((error) => {
        if (studyRequestRef.current === requestId) {
          setStudyError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (studyRequestRef.current === requestId) setStudyLoading(false);
      });
  }, [selection]);

  const handleSpeakText = async (text: string, langCode: string, key: string) => {
    try {
      setSpeakingKey(key);
      await invokeSpeech("stop_speech", {}).catch(() => {});
      await invokeSpeech("speak_text", { text, lang: langCode });
      const duration = Math.max(2000, text.length * 95 + 600);
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      speakTimerRef.current = setTimeout(() => setSpeakingKey(null), duration);
    } catch (error) {
      setSpeakingKey(null);
      if (!isTtsRecoveryError(error)) {
        console.error("Speak failed", error);
        alert(error instanceof Error ? error.message : "Speech synthesis failed.");
      }
    }
  };

  const handleDragStart = (
    event: React.DragEvent,
    name: string,
    definition: string,
    source: string
  ) => {
    draggingRef.current = true;
    const text = `[${source}] ${name}: ${definition}`;
    const refId = `[DICT] ${name}`;
    event.dataTransfer.setData("text/plain", text);
    event.dataTransfer.setData("application/verse-id", refId);
    event.dataTransfer.effectAllowed = "copy";
    setGlassDragImage(event, name);
    window.dispatchEvent(
      new CustomEvent("rhelo-drag-start", {
        detail: { verseId: refId, verseText: text },
      })
    );
  };

  const handleDragEnd = () => {
    window.dispatchEvent(new CustomEvent("rhelo-drag-end"));
    setTimeout(() => {
      draggingRef.current = false;
    }, 0);
  };

  const selectResult = (nextSelection: DictionarySelection) => {
    if (draggingRef.current) return;
    if (process.env.NODE_ENV === "development") {
      console.debug(
        `[Dictionary] selected kind=${nextSelection.kind} id=${nextSelection.id}`
      );
    }
    setSelectedVerseId(null);
    setStudyDetails(null);
    setStudyError(null);
    setStudyLoading(true);
    setSelection(nextSelection);
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    const requestId = ++searchRequestRef.current;
    setLoading(true);
    setSearched(true);
    setSelectedVerseId(null);
    setStudyDetails(null);
    setStudyError(null);
    setStudyLoading(false);
    setSelection(null);
    try {
      const [lexData, topicData] = await Promise.all([
        searchLexicon(trimmedQuery),
        searchTopics(trimmedQuery),
      ]);
      if (searchRequestRef.current !== requestId) return;
      setLexiconResults(lexData.lexicon || []);
      setDictionaryResults(lexData.dictionary || []);
      setTopicResults(topicData.topics || []);
      setNameResults(topicData.names || []);
    } catch {
      if (searchRequestRef.current !== requestId) return;
      setLexiconResults([]);
      setDictionaryResults([]);
      setTopicResults([]);
      setNameResults([]);
    } finally {
      if (searchRequestRef.current === requestId) setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setSearched(false);
    setSelectedVerseId(null);
    setStudyDetails(null);
    setStudyError(null);
    setStudyLoading(false);
    setSelection(null);
  };

  const noResults =
    lexiconResults.length === 0 &&
    dictionaryResults.length === 0 &&
    topicResults.length === 0 &&
    nameResults.length === 0;

  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 overflow-y-auto bg-slate-50 md:h-[calc(100vh-4rem)] md:grid-cols-12 md:overflow-hidden">
      <div className="col-span-1 flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden border-r border-slate-200 bg-slate-50 md:col-span-5 md:h-full md:min-h-0">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
          <h2 className="font-sans text-xl font-bold text-slate-900">Dictionary & Lexicon</h2>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-white p-6">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-4 top-4 text-slate-400" size={22} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-24 font-sans text-lg shadow-sm outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              aria-label="Search dictionary and lexicon"
            />
            <button
              type="submit"
              className="absolute bottom-1.5 right-1.5 top-1.5 flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-6 font-sans text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          {!loading && !searched && (
            <div className="pt-4">
              <h4 className="px-1 py-1 text-center font-sans text-xs font-bold uppercase tracking-wider text-slate-400">
                Suggested Searches
              </h4>
              <div className="flex flex-wrap justify-center gap-2">
                {["Agape", "Baptism", "Grace", "Zion"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 font-sans text-sm font-medium text-slate-600 transition-all hover:border-slate-300 hover:shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative flex-1 overflow-y-auto p-5 sm:p-8">
          <div className="pointer-events-none absolute left-1/3 top-1/3 h-80 w-80 rounded-full bg-blue-500/5 blur-[120px]" />

          {loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-sm text-slate-500">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <span>Scanning lexicon and dictionary databases...</span>
            </div>
          )}

          {!loading && !searched && (
            <div className="py-24 text-center text-slate-400">
              <BookMarked size={56} className="mx-auto mb-4 opacity-20" />
              <h3 className="mb-1.5 font-sans text-lg font-bold text-slate-500">
                Lexical Reference Center
              </h3>
              <p className="mx-auto max-w-sm text-sm leading-relaxed">
                Search Strong&apos;s Greek and Hebrew Lexicon, Easton&apos;s and Smith&apos;s
                dictionaries, Nave&apos;s Topical Index, and Hitchcock&apos;s Bible Names.
              </p>
            </div>
          )}

          {!loading && searched && (
            <div className="relative z-10 mx-auto max-w-4xl space-y-8">
              {lexiconResults.length > 0 && (
                <section>
                  <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-blue-700">
                    <BookOpen size={16} /> Strong&apos;s Concordance ({lexiconResults.length})
                  </h3>
                  <div className="space-y-4">
                    {lexiconResults.map((result, index) => (
                      <motion.div
                        key={result.strongs_id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        draggable
                        role="button"
                        tabIndex={0}
                        onClick={() => selectResult({ kind: "strongs", id: result.strongs_id })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            selectResult({ kind: "strongs", id: result.strongs_id });
                          }
                        }}
                        onDragStart={(event) =>
                          handleDragStart(
                            event as unknown as React.DragEvent,
                            result.lemma,
                            result.definition,
                            `Strong's ${result.strongs_id}`
                          )
                        }
                        onDragEnd={handleDragEnd}
                        className="cursor-grab rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md active:cursor-grabbing"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-700">
                              {result.strongs_id}
                            </span>
                            <span className="font-sans text-base font-bold text-slate-900">
                              {result.lemma}
                            </span>
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              const language = result.strongs_id.toUpperCase().startsWith("G")
                                ? "el"
                                : "he";
                              handleSpeakText(
                                result.lemma,
                                language,
                                `${result.strongs_id}-${index}`
                              );
                            }}
                            className={`flex cursor-pointer items-center justify-center rounded-lg border p-1.5 transition-all hover:scale-105 active:scale-95 ${
                              speakingKey === `${result.strongs_id}-${index}`
                                ? "animate-pulse border-blue-300 bg-blue-100 text-blue-700"
                                : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
                            }`}
                            title="Pronounce original word"
                            aria-label={`Hear ${result.strongs_id.toUpperCase().startsWith("G") ? "Greek" : "Hebrew"} pronunciation`}
                          >
                            <Volume2 size={14} />
                          </button>
                        </div>
                        <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-5 font-prose text-[17px] leading-relaxed text-slate-700">
                          {result.definition}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {dictionaryResults.length > 0 && (
                <section>
                  <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-sky-700">
                    <BookMarked size={16} /> Easton&apos;s & Smith&apos;s Dictionaries (
                    {dictionaryResults.length})
                  </h3>
                  <div className="space-y-4">
                    {dictionaryResults.map((result) => (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        draggable
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          selectResult({ kind: "dictionary", id: String(result.id) })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            selectResult({ kind: "dictionary", id: String(result.id) });
                          }
                        }}
                        onDragStart={(event) =>
                          handleDragStart(
                            event as unknown as React.DragEvent,
                            result.name,
                            result.definition_text,
                            dictionarySourceName(result.source)
                          )
                        }
                        onDragEnd={handleDragEnd}
                        className="cursor-grab rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-sky-300 hover:shadow-md active:cursor-grabbing"
                      >
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <div className="font-sans text-base font-bold text-slate-950">
                            {result.name}
                          </div>
                          <span className="text-xs font-semibold text-slate-400">
                            {dictionarySourceName(result.source)}
                          </span>
                        </div>
                        <p className="line-clamp-4 rounded-xl border border-slate-200 bg-slate-50 p-5 font-prose text-[17px] leading-relaxed text-slate-700 transition-all duration-300 hover:line-clamp-none">
                          {result.definition_text}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {topicResults.length > 0 && (
                <section>
                  <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-blue-700">
                    <BookOpen size={16} /> Nave&apos;s Topical Index ({topicResults.length})
                  </h3>
                  <div className="space-y-4">
                    {topicResults.map((result) => (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        draggable
                        role="button"
                        tabIndex={0}
                        onClick={() => selectResult({ kind: "topic", id: String(result.id) })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            selectResult({ kind: "topic", id: String(result.id) });
                          }
                        }}
                        onDragStart={(event) =>
                          handleDragStart(
                            event as unknown as React.DragEvent,
                            result.subject,
                            result.entry,
                            "Nave's Topical Index"
                          )
                        }
                        onDragEnd={handleDragEnd}
                        className="cursor-grab rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md active:cursor-grabbing"
                      >
                        <div className="mb-2 font-sans text-base font-bold text-blue-700">
                          {result.subject}
                        </div>
                        <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 font-prose text-[17px] italic leading-relaxed text-slate-700">
                          {result.entry}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {nameResults.length > 0 && (
                <section>
                  <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-amber-700">
                    <UserRound size={16} /> Hitchcock&apos;s Bible Names ({nameResults.length})
                  </h3>
                  <div className="space-y-4">
                    {nameResults.map((result) => (
                      <motion.div
                        key={result.name}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        draggable
                        role="button"
                        tabIndex={0}
                        onClick={() => selectResult({ kind: "name", id: result.name })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            selectResult({ kind: "name", id: result.name });
                          }
                        }}
                        onDragStart={(event) =>
                          handleDragStart(
                            event as unknown as React.DragEvent,
                            result.name,
                            result.meaning,
                            "Hitchcock's Bible Names"
                          )
                        }
                        onDragEnd={handleDragEnd}
                        className="cursor-grab rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-amber-300 hover:shadow-md active:cursor-grabbing"
                      >
                        <div className="mb-2 font-sans text-base font-bold text-slate-950">
                          {result.name}
                        </div>
                        <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 font-prose text-[17px] leading-relaxed text-slate-700">
                          {result.meaning}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {noResults && (
                <div className="py-20 text-center font-sans text-slate-500">
                  <p className="text-base">
                    No dictionary or lexicon results found for &quot;{query}&quot;.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="col-span-1 flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden bg-white md:col-span-7 md:h-full md:min-h-0">
        {selectedVerseId && studyDetails ? (
          <>
            <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
              <button
                onClick={() => setSelectedVerseId(null)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-sans text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
              >
                <ArrowLeft size={16} />
                Back to {studyDetails.title}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <StudyPane
                verseId={selectedVerseId}
                initialTab="verse"
                onVerseClick={setSelectedVerseId}
              />
            </div>
          </>
        ) : studyLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="font-sans text-sm">Loading related Scripture...</p>
          </div>
        ) : studyError ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="mb-4 text-red-500" size={42} />
            <h3 className="mb-2 font-sans text-lg font-bold text-slate-800">
              Unable to load this study entry
            </h3>
            <p className="max-w-md font-sans text-sm leading-relaxed text-slate-500">
              {studyError}
            </p>
          </div>
        ) : studyDetails ? (
          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-slate-200 bg-gradient-to-br from-blue-50 via-white to-amber-50 px-6 py-8 sm:px-10">
              <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                {studyDetails.subtitle}
              </p>
              <h3
                className={`font-bold text-slate-950 ${
                  studyDetails.kind === "strongs"
                    ? "font-prose text-4xl sm:text-5xl"
                    : "font-sans text-3xl"
                }`}
              >
                {studyDetails.title}
              </h3>
              <p className="mt-5 whitespace-pre-line font-prose text-[17px] leading-8 text-slate-700">
                {studyDetails.definition}
              </p>
            </div>

            <div className="px-6 py-7 sm:px-10">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Related Scripture
                  </p>
                  <h4 className="mt-1 font-sans text-xl font-bold text-slate-900">
                    {studyDetails.related_verses.length > 0
                      ? `${studyDetails.related_verses.length} linked verses`
                      : "No explicit references"}
                  </h4>
                </div>
              </div>

              {studyDetails.related_verses.length > 0 ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {studyDetails.related_verses.map((verse) => (
                    <button
                      key={verse.id}
                      onClick={() => setSelectedVerseId(verse.id)}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    >
                      <span className="font-sans text-sm font-bold text-blue-700">
                        {verse.book} {verse.chapter}:{verse.verse}
                      </span>
                      <p className="mt-2 line-clamp-3 font-prose text-[15px] leading-6 text-slate-600">
                        {verse.text_en}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <BookOpen className="mx-auto mb-3 text-slate-300" size={36} />
                  <p className="font-sans text-sm leading-relaxed text-slate-500">
                    This source does not provide explicit Scripture links for this entry. No
                    related verses have been inferred.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-1 flex-col items-center justify-center p-8 text-center font-sans text-slate-400">
            <BookOpen size={48} className="mb-4 text-slate-300 stroke-[1.5]" />
            <h3 className="mb-1 text-lg font-bold text-slate-700">
              Lexical Reference Center
            </h3>
            <p className="max-w-xs text-sm leading-relaxed text-slate-400">
              Select any result to inspect its definition and the Scripture references the
              bundled dataset can support.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
