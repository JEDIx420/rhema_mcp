"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, BookMarked, BookOpen } from "lucide-react";
import { searchLexicon, searchTopics } from "@/lib/api";

export default function DictionaryView() {
  const [query, setQuery] = useState("");
  const [lexiconResults, setLexiconResults] = useState<Record<string, string>[]>([]);
  const [dictionaryResults, setDictionaryResults] = useState<Record<string, string>[]>([]);
  const [topicResults, setTopicResults] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - strictly height matched h-16 (64px) */}
      <div
        className="h-16 px-6 border-b shrink-0 flex items-center justify-between"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: "var(--font-outfit), sans-serif" }}
        >
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
              className="w-full pl-14 pr-28 py-4 bg-transparent border-none outline-none text-lg text-slate-900 placeholder-slate-400 rounded-xl font-sans"
            />
            <button
              type="submit"
              className="absolute right-3 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Results Viewport */}
      <div className="flex-1 overflow-y-auto p-6 relative">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-500 text-xs">
            <Loader2 size={32} className="animate-spin text-purple-400" />
            <span>Scanning lexicon and dictionary databases...</span>
          </div>
        )}

        {!loading && !searched && (
          <div className="text-center py-24" style={{ color: "var(--text-muted)" }}>
            <BookMarked size={56} className="mx-auto mb-4 opacity-15" />
            <h3 className="text-base font-bold text-slate-300 mb-1">Lexical Reference Center</h3>
            <p className="text-xs max-w-sm mx-auto leading-normal">
              Perform multi-index searches across Strong&apos;s Greek/Hebrew Lexicon, Easton&apos;s Bible Dictionary, Smith&apos;s Bible Dictionary, and Nave&apos;s Topical Index.
            </p>
          </div>
        )}

        {!loading && searched && (
          <div className="max-w-4xl mx-auto space-y-8 z-10 relative">
            
            {/* Strong's Lexicon */}
            {lexiconResults.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--accent)" }}>
                  <BookOpen size={14} /> Strong&apos;s Concordance ({lexiconResults.length})
                </h3>
                <div className="space-y-2.5">
                  {lexiconResults.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border transition-all hover:border-purple-500/25"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10" style={{ color: "var(--accent)" }}>
                          {r.strongs_id}
                        </span>
                        <span className="text-sm font-semibold text-slate-200">{r.lemma}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300 bg-slate-900/30 p-3 rounded-lg border border-slate-800/60">
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
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--secondary)" }}>
                  <BookMarked size={14} /> Easton&apos;s & Smith&apos;s Dictionaries ({dictionaryResults.length})
                </h3>
                <div className="space-y-2.5">
                  {dictionaryResults.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border transition-all hover:border-sky-500/20"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                    >
                      <div className="font-bold text-sm text-slate-200 mb-1.5">{r.name}</div>
                      <p className="text-xs leading-relaxed text-slate-400 bg-slate-900/10 p-3 rounded-lg border border-slate-950/20 line-clamp-4 hover:line-clamp-none transition-all duration-300">
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
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--primary)" }}>
                  <BookOpen size={14} /> Nave&apos;s Topical Index ({topicResults.length})
                </h3>
                <div className="space-y-2.5">
                  {topicResults.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border transition-all hover:border-blue-300 shadow-sm"
                      style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                    >
                      <div className="font-bold text-sm text-blue-600 mb-1">{r.subject}</div>
                      <p className="text-xs leading-relaxed text-slate-400 italic">
                        {r.entry}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {lexiconResults.length === 0 && dictionaryResults.length === 0 && topicResults.length === 0 && (
              <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
                <p className="text-sm">No dictionary or lexicon results found for &quot;{query}&quot;.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
