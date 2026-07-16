"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { AlertCircle, Database, HardDrive, Info, RefreshCw, Settings, ShieldCheck, Square, Volume2 } from "lucide-react";
import { fetchStats, fetchTtsDiagnostics, type TtsDiagnosticsResponse } from "@/lib/api";
import { getBrowserTtsDiagnostics, getTtsTestText, invokeSpeech, summarizeSelectedVoice } from "@/lib/speech";
import { openSpeechSettings } from "@/utils/SystemHelper";

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
  const [ttsDiagnostics, setTtsDiagnostics] = useState<TtsDiagnosticsResponse | null>(null);
  const [ttsLoading, setTtsLoading] = useState(true);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [speakingLang, setSpeakingLang] = useState<"en" | "el" | "he" | null>(null);
  const [browserDiagnostics, setBrowserDiagnostics] = useState(() => getBrowserTtsDiagnostics());

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await fetchStats();
      setStats(data.stats);
      setStatus("connected");
    } catch {
      setStats(null);
      setStatus("disconnected");
    } finally {
      setLoading(false);
    }
  };

  const loadTtsDiagnostics = async () => {
    setTtsLoading(true);
    setTtsError(null);
    setBrowserDiagnostics(getBrowserTtsDiagnostics());

    try {
      const result = await fetchTtsDiagnostics();
      setTtsDiagnostics(result);
    } catch (error) {
      setTtsDiagnostics(null);
      setTtsError(error instanceof Error ? error.message : String(error));
    } finally {
      setTtsLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadStats(), loadTtsDiagnostics()]);
  };
  const loadInitialData = useEffectEvent(refreshAll);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;

    const handleVoicesChanged = () => {
      setBrowserDiagnostics(getBrowserTtsDiagnostics());
    };

    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
  }, []);

  const handleTest = async (lang: "en" | "el" | "he") => {
    setSpeakingLang(lang);
    try {
      await invokeSpeech("speak_text", { text: getTtsTestText(lang), lang });
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      window.setTimeout(() => setSpeakingLang((current) => (current === lang ? null : current)), 1200);
    }
  };

  const handleStop = async () => {
    try {
      await invokeSpeech("stop_speech", {});
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setSpeakingLang(null);
    }
  };

  const rows = ttsDiagnostics
    ? [
        {
          label: "English voice available",
          available: ttsDiagnostics.english.available,
          selected: summarizeSelectedVoice(ttsDiagnostics.english),
        },
        {
          label: "Greek voice available",
          available: ttsDiagnostics.greek.available,
          selected: summarizeSelectedVoice(ttsDiagnostics.greek),
        },
        {
          label: "Hebrew voice available",
          available: ttsDiagnostics.hebrew.available,
          selected: summarizeSelectedVoice(ttsDiagnostics.hebrew),
        },
      ]
    : [];

  const isWindows = (ttsDiagnostics?.os || browserDiagnostics.voices[0]?.lang || navigator.userAgent).toLowerCase().includes("win");

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
        <div className="flex items-center gap-2.5">
          <Settings size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900 font-sans">
            Settings & Local Data
          </h2>
        </div>
        <button
          onClick={() => void refreshAll()}
          disabled={loading || ttsLoading}
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          title="Refresh connection status and TTS diagnostics"
        >
          <RefreshCw size={18} className={loading || ttsLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="max-w-5xl flex-1 space-y-8 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 font-sans">
              <HardDrive size={18} className="text-blue-500" />
              Local Study Database
            </h3>
            <p className="text-sm text-slate-500 font-sans">
              Managed automatically by Rhelo &bull; SQLite (rhelo.db)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${
              status === "connected" ? "bg-blue-500 animate-pulse" : "bg-red-500"
            }`} />
            <span
              className="text-sm font-bold uppercase tracking-wider font-sans"
              style={{ color: status === "connected" ? "var(--primary)" : "#f87171" }}
            >
              {status === "connected" ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        <div>
          <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
            <Database size={14} /> Database Statistics & Ingestion Metrics
          </h4>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500 font-sans">Total Scriptures</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900">
                {loading ? "..." : stats?.verses?.toLocaleString() || "—"}
              </div>
              <span className="mt-1 block text-xs text-slate-400 font-sans">66 Books (KJV & original scripts aligned)</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500 font-sans">Lexicon Entries</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900">
                {loading ? "..." : stats?.lexicon?.toLocaleString() || "—"}
              </div>
              <span className="mt-1 block text-xs text-slate-400 font-sans">Strong&apos;s Greek & Hebrew Definitions</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500 font-sans">Geocoded Places</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900">
                {loading ? "..." : stats?.places?.toLocaleString() || "—"}
              </div>
              <span className="mt-1 block text-xs text-slate-400 font-sans">GIS latitude/longitude mapping tags</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500 font-sans">Biographies Cached</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900">
                {loading ? "..." : stats?.people?.toLocaleString() || "—"}
              </div>
              <span className="mt-1 block text-xs text-slate-400 font-sans">Profiles from genealogical graphs</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500 font-sans">Chronological Events</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900">
                {loading ? "..." : stats?.events?.toLocaleString() || "—"}
              </div>
              <span className="mt-1 block text-xs text-slate-400 font-sans">Historical timelines mapped to verses</span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase text-slate-500 font-sans">Dictionaries Entries</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900">
                {loading ? "..." : stats?.dictionaries?.toLocaleString() || "—"}
              </div>
              <span className="mt-1 block text-xs text-slate-400 font-sans">Easton&apos;s & Smith&apos;s dictionaries</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
            <ShieldCheck size={14} /> TTS Diagnostics
          </h4>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Detected OS</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{ttsDiagnostics?.os || navigator.platform}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Schema Version</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {ttsDiagnostics ? ttsDiagnostics.current_schema_version : "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Native TTS available</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {ttsLoading ? "Checking..." : ttsDiagnostics?.native_tts_available ? "Yes" : "No"}
                </div>
                {ttsDiagnostics?.initialization_error ? (
                  <p className="mt-2 text-xs text-red-600">{ttsDiagnostics.initialization_error}</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Browser speech fallback</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {browserDiagnostics.available ? "Available" : "Unavailable"}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Browser voices detected: {browserDiagnostics.voices.length}
                </p>
              </div>
            </div>

            {ttsError ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{ttsError}</span>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Language</th>
                    <th className="px-4 py-3">Native voice</th>
                    <th className="px-4 py-3">Selected voice</th>
                    <th className="px-4 py-3">Browser fallback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {ttsLoading && rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={4}>
                        Loading native voice diagnostics...
                      </td>
                    </tr>
                  ) : null}
                  {!ttsLoading && rows.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={4}>
                        Native voice diagnostics are unavailable. Use Refresh voices to try again.
                      </td>
                    </tr>
                  ) : null}
                  {rows.map((row) => {
                    const browserVoice =
                      row.label.startsWith("English")
                        ? browserDiagnostics.english
                        : row.label.startsWith("Greek")
                          ? browserDiagnostics.greek
                          : browserDiagnostics.hebrew;

                    return (
                      <tr key={row.label}>
                        <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                        <td className="px-4 py-3 text-slate-700">{row.available ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 text-slate-700">{row.selected}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {browserVoice ? `${browserVoice.name} (${browserVoice.lang})` : "None"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadTtsDiagnostics()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCw size={16} className={ttsLoading ? "animate-spin" : ""} />
                Refresh voices
              </button>
              <button
                onClick={() => void handleTest("en")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Volume2 size={16} className={speakingLang === "en" ? "animate-pulse" : ""} />
                Test English
              </button>
              <button
                onClick={() => void handleTest("el")}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                <Volume2 size={16} className={speakingLang === "el" ? "animate-pulse" : ""} />
                Test Greek
              </button>
              <button
                onClick={() => void handleTest("he")}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <Volume2 size={16} className={speakingLang === "he" ? "animate-pulse" : ""} />
                Test Hebrew
              </button>
              <button
                onClick={() => void handleStop()}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <Square size={16} />
                Stop speech
              </button>
            </div>

            {isWindows && (!ttsDiagnostics?.greek.available || !ttsDiagnostics?.hebrew.available) ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-semibold">Windows voice guidance</p>
                <p className="mt-1">
                  Rhelo only reports Greek or Hebrew as supported when a compatible voice is actually detected.
                  If one is missing, install the matching Windows speech/language voice and refresh diagnostics.
                </p>
                <button
                  onClick={openSpeechSettings}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  Open speech settings
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <h4 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
            <ShieldCheck size={14} /> Rhelo interface theme
          </h4>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500 font-sans">
              The dashboard uses the following active design style tokens defined in the specification:
            </p>
            <div className="grid grid-cols-2 gap-3 text-center text-sm font-bold font-sans md:grid-cols-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 text-blue-600">
                Primary: Royal Blue
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 text-sky-600">
                Secondary: Sky Blue
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 text-indigo-600">
                Accent: Indigo
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-800">
                Contrast Base
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <Info size={20} className="mt-0.5 shrink-0 text-slate-500" />
          <div className="space-y-1.5 text-sm leading-relaxed text-slate-650 font-sans">
            <span className="block text-base font-bold text-slate-850">Attribution & Licenses Notice</span>
            All database layers in the Rhelo study engine are loaded from public-domain and open-source data assets,
            including BSB, WEB, KJV English, MorphGNT / BYZ Greek, FreeBiblesIndia Indic texts, OpenBible.info
            cross-references, Lifegems chronology data, and Brady Stephenson&apos;s genealogical datasets.
          </div>
        </div>
      </div>
    </div>
  );
}
