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
        <div className="flex items-center gap-2.5">
          <Settings size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900 font-sans">
            Settings & Server Status
          </h2>
        </div>
        <button
          onClick={loadStats}
          disabled={loading}
          className="p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer text-slate-500 hover:text-slate-800"
          title="Refresh connection status"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-4xl">
        
        {/* Connection Status Panel */}
        <div className="p-6 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 bg-white shadow-sm">
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 font-sans">
              <HardDrive size={18} className="text-blue-500" />
              Local Exegesis Server Link
            </h3>
            <p className="text-sm text-slate-500 font-sans">
              Host: <code className="bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded text-xs text-blue-600 font-mono">http://localhost:5050</code> &bull; Driver: SQLite (rhema.db)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${
              status === "connected" ? "bg-blue-500 animate-pulse" : "bg-red-500"
            }`} />
            <span className="text-sm uppercase font-bold tracking-wider font-sans"
                  style={{ color: status === "connected" ? "var(--primary)" : "#f87171" }}>
              {status === "connected" ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Database Metrics Grid */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2 font-sans">
            <Database size={14} /> Database Statistics & Ingestion Metrics
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="text-slate-500 text-xs uppercase font-bold font-sans">Total Scriptures</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {loading ? "..." : stats?.verses?.toLocaleString() || "—"}
              </div>
              <span className="text-xs text-slate-400 mt-1 block font-sans">66 Books (KJV & original scripts aligned)</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="text-slate-500 text-xs uppercase font-bold font-sans">Lexicon Entries</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {loading ? "..." : stats?.lexicon?.toLocaleString() || "—"}
              </div>
              <span className="text-xs text-slate-400 mt-1 block font-sans">Strong&apos;s Greek & Hebrew Definitions</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="text-slate-500 text-xs uppercase font-bold font-sans">Geocoded Places</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {loading ? "..." : stats?.places?.toLocaleString() || "—"}
              </div>
              <span className="text-xs text-slate-400 mt-1 block font-sans">GIS latitude/longitude mapping tags</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="text-slate-500 text-xs uppercase font-bold font-sans">Biographies Cached</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {loading ? "..." : stats?.people?.toLocaleString() || "—"}
              </div>
              <span className="text-xs text-slate-400 mt-1 block font-sans">Profiles from genealogical graphs</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="text-slate-500 text-xs uppercase font-bold font-sans">Chronological Events</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {loading ? "..." : stats?.events?.toLocaleString() || "—"}
              </div>
              <span className="text-xs text-slate-400 mt-1 block font-sans">Historical timelines mapped to verses</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="text-slate-500 text-xs uppercase font-bold font-sans">Dictionaries Entries</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {loading ? "..." : stats?.dictionaries?.toLocaleString() || "—"}
              </div>
              <span className="text-xs text-slate-400 mt-1 block font-sans">Easton&apos;s & Smith&apos;s dictionaries</span>
            </div>
          </div>
        </div>

        {/* Theme Settings Display */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2 font-sans">
            <ShieldCheck size={14} /> Design System theme variables (zenrev aesthetics)
          </h4>
          <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <p className="text-sm text-slate-500 font-sans">
              The dashboard uses the following active design style tokens defined in the specification:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm font-bold font-sans">
              <div className="p-3.5 rounded-xl border text-blue-600 border-blue-200 bg-blue-50/50">
                Primary: Royal Blue
              </div>
              <div className="p-3.5 rounded-xl border text-sky-600 border-sky-200 bg-sky-50/50">
                Secondary: Sky Blue
              </div>
              <div className="p-3.5 rounded-xl border text-indigo-600 border-indigo-200 bg-indigo-50/50">
                Accent: Indigo
              </div>
              <div className="p-3.5 rounded-xl border text-slate-800 border-slate-200 bg-slate-50">
                Contrast Base
              </div>
            </div>
          </div>
        </div>

        {/* License & Attribution Notice */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 flex items-start gap-4">
          <Info size={20} className="text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-sm text-slate-650 leading-relaxed font-sans">
            <span className="font-bold text-slate-850 block text-base">Attribution & Licenses Notice</span>
            All database layers in the Rhema study engine are loaded from public domain and open-source data assets: KJV English, MorphGNT / BYZ Greek, FreeBiblesIndia Indic texts (USFM), OpenBible.info cross-reference matrix, Lifegems chronology timeline database, and Stephen Brady genealogical index profiles.
          </div>
        </div>
      </div>
    </div>
  );
}
