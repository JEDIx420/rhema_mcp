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
      {/* Header */}
      <div
        className="px-6 py-5 border-b shrink-0"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <h2
          className="text-xl font-bold mb-4"
          style={{ fontFamily: "var(--font-outfit), sans-serif" }}
        >
          Dictionary & Lexicon
        </h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={"Search Strong's, Easton's, Smith's, Nave's (e.g. \"grace\", \"baptism\")"}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border outline-none"
              style={{
                background: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
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

        {!loading && !searched && (
          <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
            <BookMarked size={56} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg mb-1">Bible Dictionary & Lexicon</p>
            <p className="text-sm">Search across Strong&apos;s Concordance, Easton&apos;s, Smith&apos;s, and Nave&apos;s Topical Index.</p>
          </div>
        )}

        {!loading && searched && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Strong's Lexicon */}
            {lexiconResults.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--accent)" }}>
                  <BookOpen size={16} /> Strong&apos;s Concordance ({lexiconResults.length})
                </h3>
                {lexiconResults.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-3 rounded-lg mb-2 border"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(167, 139, 250, 0.15)", color: "var(--accent)" }}>
                        {r.strongs_id}
                      </span>
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.lemma}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{r.definition}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Dictionary Entries */}
            {dictionaryResults.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--secondary)" }}>
                  <BookMarked size={16} /> Easton&apos;s & Smith&apos;s ({dictionaryResults.length})
                </h3>
                {dictionaryResults.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-3 rounded-lg mb-2 border"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                  >
                    <div className="font-medium text-sm mb-1" style={{ color: "var(--text-primary)" }}>{r.name}</div>
                    <p className="text-xs leading-relaxed line-clamp-4" style={{ color: "var(--text-muted)" }}>{r.definition_text}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Nave's Topics */}
            {topicResults.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--primary)" }}>
                  <BookOpen size={16} /> Nave&apos;s Topical Index ({topicResults.length})
                </h3>
                {topicResults.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-3 rounded-lg mb-2 border"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                  >
                    <div className="font-medium text-sm mb-1" style={{ color: "var(--primary)" }}>{r.subject}</div>
                    <p className="text-xs leading-relaxed line-clamp-3" style={{ color: "var(--text-muted)" }}>{r.entry}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {lexiconResults.length === 0 && dictionaryResults.length === 0 && topicResults.length === 0 && (
              <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
                <p>No results found for &quot;{query}&quot;</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
