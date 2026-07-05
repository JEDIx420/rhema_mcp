"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, BookMarked, BookOpen, Volume2 } from "lucide-react";
import { searchLexicon, searchTopics } from "@/lib/api";

export default function DictionaryView() {
  const [query, setQuery] = useState("");
  const [lexiconResults, setLexiconResults] = useState<Record<string, string>[]>([]);
  const [dictionaryResults, setDictionaryResults] = useState<Record<string, string>[]>([]);
  const [topicResults, setTopicResults] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);

  const handleSpeakText = async (text: string, langCode: string, key: string) => {
    try {
      setSpeakingKey(key);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5050";
      const res = await fetch(`${apiBase}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language_code: langCode })
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => setSpeakingKey(null);
      audio.onerror = () => setSpeakingKey(null);
    } catch (err) {
      console.error("Speak failed", err);
      setSpeakingKey(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, name: string, definition: string, source: string) => {
    const text = `[${source}] ${name}: ${definition}`;
    const refId = `[DICT] ${name}`;
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.setData("application/verse-id", refId);
    e.dataTransfer.effectAllowed = "copy";
    const dragEvent = new CustomEvent("targum-drag-start", { detail: { verseId: refId, verseText: text } });
    window.dispatchEvent(dragEvent);
  };

  const handleDragEnd = () => {
    const dragEvent = new CustomEvent("targum-drag-end");
    window.dispatchEvent(dragEvent);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const [lexData, topicData] = await Promise.all([
        searchLexicon(query),
        searchTopics(query),
      ]);
      setLexiconResults(lexData.lexicon || []);
      setDictionaryResults(lexData.dictionary || []);
      setTopicResults(topicData.topics || []);
    } catch {
      setLexiconResults([]);
      setDictionaryResults([]);
      setTopicResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="h-16 px-6 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 font-sans">
          Dictionary & Lexicon
        </h2>
      </div>

      {/* Dictionary Query Area */}
      <div className="p-8 border-b border-slate-200 shrink-0 bg-slate-50 flex justify-center">
        <form onSubmit={handleSearch} className="w-full max-w-2xl">
          <div className="relative flex items-center bg-white rounded-xl shadow-sm border border-slate-300 transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <Search
              size={22}
              className="absolute left-5 pointer-events-none text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={"Search Strong's, Easton's, Smith's, Nave's (e.g., \"grace\", \"baptism\")..."}
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

      {/* Results Viewport */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-555 text-sm">
            <Loader2 size={32} className="animate-spin text-purple-600" />
            <span>Scanning lexicon and dictionary databases...</span>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-24 text-slate-400">
            <BookMarked size={56} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-slate-500 mb-1.5 font-sans">Lexical Reference Center</h3>
            <p className="text-sm max-w-sm mx-auto leading-relaxed">
              Perform multi-index searches across Strong&apos;s Greek/Hebrew Lexicon, Easton&apos;s Bible Dictionary, Smith&apos;s Bible Dictionary, and Nave&apos;s Topical Index.
            </p>
          </div>
        )}

        {!loading && searched && (
          <div className="max-w-4xl mx-auto space-y-8 z-10 relative">
            
            {/* Strong's Lexicon */}
            {lexiconResults.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-purple-700 font-sans">
                  <BookOpen size={16} /> Strong&apos;s Concordance ({lexiconResults.length})
                </h3>
                <div className="space-y-4">
                  {lexiconResults.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, r.lemma, r.definition, `Strong's ${r.strongs_id}`)}
                      onDragEnd={handleDragEnd}
                      className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-purple-300 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            {r.strongs_id}
                          </span>
                          <span className="text-base font-bold text-slate-900 font-sans">{r.lemma}</span>
                        </div>
                        <button
                          onClick={() => {
                            const isGreek = r.strongs_id?.toUpperCase().startsWith("G");
                            const lang = isGreek ? "el" : "he";
                            handleSpeakText(r.lemma, lang, `${r.strongs_id}-${i}`);
                          }}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center hover:scale-105 active:scale-95 ${
                            speakingKey === `${r.strongs_id}-${i}`
                              ? "bg-purple-100 text-purple-700 border-purple-300 animate-pulse"
                              : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300"
                          }`}
                          title="Pronounce original word"
                        >
                          <Volume2 size={14} className={speakingKey === `${r.strongs_id}-${i}` ? "animate-[bounce_1.5s_infinite]" : ""} />
                        </button>
                      </div>
                      <p className="text-[17px] leading-relaxed text-slate-700 bg-slate-50 p-5 rounded-xl border border-slate-200 font-prose whitespace-pre-line">
                        {r.definition}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Dictionary Entries */}
            {dictionaryResults.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-sky-700 font-sans">
                  <BookMarked size={16} /> Easton&apos;s & Smith&apos;s Dictionaries ({dictionaryResults.length})
                </h3>
                <div className="space-y-4">
                  {dictionaryResults.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, r.name, r.definition_text, "Easton/Smith Dictionary")}
                      onDragEnd={handleDragEnd}
                      className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-sky-300 cursor-grab active:cursor-grabbing"
                    >
                      <div className="font-bold text-base text-slate-950 mb-2 font-sans">{r.name}</div>
                      <p className="text-[17px] leading-relaxed text-slate-700 bg-slate-50 p-5 rounded-xl border border-slate-200 font-prose line-clamp-4 hover:line-clamp-none transition-all duration-300">
                        {r.definition_text}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Nave's Topics */}
            {topicResults.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-blue-700 font-sans">
                  <BookOpen size={16} /> Nave&apos;s Topical Index ({topicResults.length})
                </h3>
                <div className="space-y-4">
                  {topicResults.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e as any, r.subject, r.entry, "Nave's Topical Index")}
                      onDragEnd={handleDragEnd}
                      className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-300 cursor-grab active:cursor-grabbing"
                    >
                      <div className="font-bold text-base text-blue-600 mb-2 font-sans">{r.subject}</div>
                      <p className="text-[17px] leading-relaxed text-slate-700 bg-slate-50 p-5 rounded-xl border border-slate-200 font-prose italic">
                        {r.entry}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {lexiconResults.length === 0 && dictionaryResults.length === 0 && topicResults.length === 0 && (
              <div className="text-center py-20 text-slate-500 font-sans">
                <p className="text-base">No dictionary or lexicon results found for &quot;{query}&quot;.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
