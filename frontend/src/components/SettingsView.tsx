"use client";

import { useState, useEffect } from "react";
import { Settings, ShieldCheck, Database, HardDrive, RefreshCw, Info } from "lucide-react";
import { fetchStats } from "@/lib/api";

interface DBStats {
  verses: number;
  lexicon: number;
  dictionaries: number;
  places: number;
  events: number;
  people: number;
}

export default function SettingsView() {
  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"connected" | "disconnected">("disconnected");

  const loadStats = () => {
    setLoading(true);
    fetchStats()
      .then((data) => {
        setStats(data.stats);
        setStatus("connected");
      })
      .catch(() => {
        setStats(null);
        setStatus("disconnected");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header - strictly height matched h-16 (64px) */}
      <div
        className="h-16 px-6 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Settings size={18} style={{ color: "var(--primary)" }} />
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
            Settings & Server Status
          </h2>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-slate-400 hover:text-slate-200"
          title="Refresh connection status"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl">
        
        {/* Connection Status Panel */}
        <div className="p-5 rounded-2xl border flex items-center justify-between gap-4 bg-white shadow-sm"
             style={{ borderColor: "var(--border-subtle)" }}>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <HardDrive size={16} className="text-blue-500" />
              Local Exegesis Server Link
            </h3>
            <p className="text-xs text-slate-500">
              Host: <code className="bg-slate-100 border border-slate-200/60 px-1 py-0.5 rounded text-[10px] text-blue-600 font-mono">http://localhost:5050</code> &bull; Driver: SQLite (rhema.db)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${
              status === "connected" ? "bg-blue-500 animate-pulse" : "bg-red-500"
            }`} />
            <span className="text-xs uppercase font-bold tracking-wider"
                  style={{ color: status === "connected" ? "var(--primary)" : "#f87171" }}>
              {status === "connected" ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Database Metrics Grid */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Database size={12} /> Database Statistics & Ingestion Metrics
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border bg-white shadow-sm" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="text-slate-500 text-[10px] uppercase font-bold">Total Scriptures</div>
              <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {loading ? "..." : stats?.verses?.toLocaleString() || "—"}
              </div>
              <span className="text-[9px] text-slate-400">66 Books (KJV & original scripts aligned)</span>
            </div>

            <div className="p-4 rounded-xl border bg-white shadow-sm" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="text-slate-500 text-[10px] uppercase font-bold">Lexicon Entries</div>
              <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {loading ? "..." : stats?.lexicon?.toLocaleString() || "—"}
              </div>
              <span className="text-[9px] text-slate-400">Strong&apos;s Greek & Hebrew Definitions</span>
            </div>

            <div className="p-4 rounded-xl border bg-white shadow-sm" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="text-slate-500 text-[10px] uppercase font-bold">Geocoded Places</div>
              <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {loading ? "..." : stats?.places?.toLocaleString() || "—"}
              </div>
              <span className="text-[9px] text-slate-400">GIS latitude/longitude mapping tags</span>
            </div>

            <div className="p-4 rounded-xl border bg-white shadow-sm" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="text-slate-500 text-[10px] uppercase font-bold">Biographies Cached</div>
              <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {loading ? "..." : stats?.people?.toLocaleString() || "—"}
              </div>
              <span className="text-[9px] text-slate-400">Profiles from genealogical graphs</span>
            </div>

            <div className="p-4 rounded-xl border bg-white shadow-sm" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="text-slate-500 text-[10px] uppercase font-bold">Chronological Events</div>
              <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {loading ? "..." : stats?.events?.toLocaleString() || "—"}
              </div>
              <span className="text-[9px] text-slate-400">Historical timelines mapped to verses</span>
            </div>

            <div className="p-4 rounded-xl border bg-white shadow-sm" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="text-slate-500 text-[10px] uppercase font-bold">Dictionaries Entries</div>
              <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
                {loading ? "..." : stats?.dictionaries?.toLocaleString() || "—"}
              </div>
              <span className="text-[9px] text-slate-400">Easton&apos;s & Smith&apos;s dictionaries</span>
            </div>
          </div>
        </div>

        {/* Theme Settings Display */}
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <ShieldCheck size={12} /> Design System theme variables (zenrev aesthetics)
          </h4>
          <div className="p-5 rounded-2xl border bg-white shadow-sm space-y-4" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-xs text-slate-500">
              The dashboard uses the following active design style tokens defined in the specification:
            </p>
            <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
              <div className="p-2.5 rounded-lg border text-blue-600 border-blue-200 bg-blue-50">
                Primary: Royal Blue
              </div>
              <div className="p-2.5 rounded-lg border text-sky-600 border-sky-200 bg-sky-50">
                Secondary: Sky Blue
              </div>
              <div className="p-2.5 rounded-lg border text-indigo-600 border-indigo-200 bg-indigo-50">
                Accent: Indigo
              </div>
              <div className="p-2.5 rounded-lg border text-slate-800 border-slate-200 bg-slate-50">
                Contrast Base
              </div>
            </div>
          </div>
        </div>

        {/* License & Attribution Notice */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
          <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700 block">Attribution & Licenses Notice</span>
            All database layers in the Rhema study engine are loaded from public domain and open-source data assets: KJV English, MorphGNT / BYZ Greek, FreeBiblesIndia Indic texts (USFM), OpenBible.info cross-reference matrix, Lifegems chronology timeline database, and Stephen Brady genealogical index profiles.
          </div>
        </div>
      </div>
    </div>
  );
}
