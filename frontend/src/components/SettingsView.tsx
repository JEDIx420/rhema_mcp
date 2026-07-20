"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Database, ExternalLink, HardDrive, Info, RefreshCw, Settings, ShieldCheck, Square, Volume2 } from "lucide-react";
import { fetchStats, fetchTtsDiagnostics, type TtsDiagnosticsResponse } from "@/lib/api";
import { getBrowserTtsDiagnostics, getTtsTestText, invokeSpeech, isTtsRecoveryError, summarizeSelectedVoice } from "@/lib/speech";
import { consumeFocusRefresh, isWindowsPlatform, type OriginalLanguage, type TtsSettingsTarget } from "@/lib/ttsRecovery";
import { openWindowsLanguageSettings, openWindowsSpeechSettings } from "@/utils/SystemHelper";

interface DBStats {
  verses: number;
  lexicon: number;
  dictionaries: number;
  places: number;
  events: number;
  people: number;
}

export default function SettingsView({ navigationTarget }: { navigationTarget: TtsSettingsTarget | null }) {
  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"connected" | "disconnected">("disconnected");
  const [ttsDiagnostics, setTtsDiagnostics] = useState<TtsDiagnosticsResponse | null>(null);
  const [ttsLoading, setTtsLoading] = useState(true);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [speakingLang, setSpeakingLang] = useState<"en" | "el" | "he" | null>(null);
  const [browserDiagnostics, setBrowserDiagnostics] = useState(() => getBrowserTtsDiagnostics());
  const [ttsFeedback, setTtsFeedback] = useState<string | null>(null);
  const [settingsOpenError, setSettingsOpenError] = useState<string | null>(null);
  const [highlightLanguage, setHighlightLanguage] = useState<OriginalLanguage | null>(null);
  const ttsDiagnosticsRef = useRef<TtsDiagnosticsResponse | null>(null);
  const browserDiagnosticsRef = useRef(browserDiagnostics);
  const refreshInFlightRef = useRef(false);
  const pendingSettingsFocusRef = useRef(false);
  const ttsSectionRef = useRef<HTMLDivElement>(null);
  const greekCardRef = useRef<HTMLDivElement>(null);
  const hebrewCardRef = useRef<HTMLDivElement>(null);

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

  const loadTtsDiagnostics = async (announce = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setTtsLoading(true);
    setTtsError(null);
    if (announce) setTtsFeedback(null);
    const previousNative = ttsDiagnosticsRef.current;
    const previousBrowser = browserDiagnosticsRef.current;
    const nextBrowser = getBrowserTtsDiagnostics();
    browserDiagnosticsRef.current = nextBrowser;
    setBrowserDiagnostics(nextBrowser);

    try {
      const result = await fetchTtsDiagnostics();
      ttsDiagnosticsRef.current = result;
      setTtsDiagnostics(result);
      const greekWasReady = Boolean(previousNative?.greek.available || previousBrowser.greek);
      const hebrewWasReady = Boolean(previousNative?.hebrew.available || previousBrowser.hebrew);
      const greekReady = Boolean(result.greek.available || nextBrowser.greek);
      const hebrewReady = Boolean(result.hebrew.available || nextBrowser.hebrew);
      if (!greekWasReady && greekReady) setTtsFeedback("Greek voice detected");
      else if (!hebrewWasReady && hebrewReady) setTtsFeedback("Hebrew voice detected");
      else if (announce) setTtsFeedback("Voice detection refreshed");
    } catch (error) {
      ttsDiagnosticsRef.current = null;
      setTtsDiagnostics(null);
      setTtsError(error instanceof Error ? error.message : String(error));
      if (announce) setTtsFeedback("Voice detection could not be refreshed");
    } finally {
      setTtsLoading(false);
      refreshInFlightRef.current = false;
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadStats(), loadTtsDiagnostics(false)]);
  };
  const loadInitialData = useEffectEvent(refreshAll);
  const loadVoicesAfterEvent = useEffectEvent(() => loadTtsDiagnostics(false));

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;

    const handleVoicesChanged = () => void loadVoicesAfterEvent();

    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
  }, []);

  useEffect(() => {
    const handleSettingsOpened = () => {
      pendingSettingsFocusRef.current = true;
    };
    const handleFocus = () => {
      const focusRefresh = consumeFocusRefresh(pendingSettingsFocusRef.current);
      pendingSettingsFocusRef.current = focusRefresh.pending;
      if (!focusRefresh.shouldRefresh) return;
      void loadVoicesAfterEvent();
    };
    window.addEventListener("rhelo:windows-settings-opened", handleSettingsOpened);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("rhelo:windows-settings-opened", handleSettingsOpened);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (navigationTarget?.section !== "tts") return;
    setHighlightLanguage(navigationTarget.missingLanguage);
    window.requestAnimationFrame(() => {
      ttsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const card = navigationTarget.missingLanguage === "greek" ? greekCardRef.current : hebrewCardRef.current;
      card?.focus({ preventScroll: true });
    });
    const timeout = window.setTimeout(() => setHighlightLanguage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [navigationTarget]);

  useEffect(() => {
    if (!ttsFeedback) return undefined;
    const timeout = window.setTimeout(() => setTtsFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [ttsFeedback]);

  const handleTest = async (lang: "en" | "el" | "he") => {
    setSpeakingLang(lang);
    try {
      await invokeSpeech("speak_text", { text: getTtsTestText(lang), lang });
    } catch (error) {
      if (!isTtsRecoveryError(error)) setTtsError(error instanceof Error ? error.message : String(error));
    } finally {
      window.setTimeout(() => setSpeakingLang((current) => (current === lang ? null : current)), 1200);
    }
  };

  const handleOpenWindowsSettings = async (page: "language" | "speech", language?: OriginalLanguage) => {
    setSettingsOpenError(null);
    const result = page === "language"
      ? await openWindowsLanguageSettings(language)
      : await openWindowsSpeechSettings();
    if (!result.opened) {
      setSettingsOpenError(result.error || "Open Windows Settings manually and choose Time & language.");
    } else if (result.used_fallback) {
      setSettingsOpenError("Windows opened general Settings instead of the requested page. Follow the manual steps below.");
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

  const isWindows = isWindowsPlatform(ttsDiagnostics?.os || navigator.userAgent);
  const greekReady = Boolean(ttsDiagnostics?.greek.available || browserDiagnostics.greek);
  const hebrewReady = Boolean(ttsDiagnostics?.hebrew.available || browserDiagnostics.hebrew);
  const greekVoice = ttsDiagnostics?.greek.selected_voice?.name || browserDiagnostics.greek?.name || null;
  const hebrewVoice = ttsDiagnostics?.hebrew.selected_voice?.name || browserDiagnostics.hebrew?.name || null;

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

        <div ref={ttsSectionRef} className="scroll-mt-6">
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

            {ttsFeedback ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800" role="status">
                <CheckCircle2 size={17} className="shrink-0" />
                {ttsFeedback}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadTtsDiagnostics(true)}
                disabled={ttsLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw size={16} className={ttsLoading ? "animate-spin" : ""} />
                Refresh Voice Detection
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

            <div className="border-t border-slate-200 pt-5">
              <div className="mb-4">
                <h5 className="text-base font-bold text-slate-900">Original-Language Voice Setup</h5>
                <p className="mt-1 text-sm text-slate-500">
                  Rhelo uses only a compatible voice for each original language. It never substitutes an English voice.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {([
                  { language: "greek" as const, title: "Greek pronunciation", ready: greekReady, voice: greekVoice, lang: "el" as const },
                  { language: "hebrew" as const, title: "Hebrew pronunciation", ready: hebrewReady, voice: hebrewVoice, lang: "he" as const },
                ]).map((item) => (
                  <div
                    key={item.language}
                    ref={item.language === "greek" ? greekCardRef : hebrewCardRef}
                    tabIndex={-1}
                    className={`rounded-2xl border p-5 outline-none transition-all ${
                      highlightLanguage === item.language
                        ? "border-amber-400 bg-amber-50 ring-4 ring-amber-100"
                        : item.ready
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-amber-200 bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h6 className="font-bold text-slate-900">{item.title}</h6>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        item.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {item.ready ? "Ready" : "Voice not installed"}
                      </span>
                    </div>
                    {item.ready ? (
                      <>
                        <p className="mt-3 text-sm text-slate-600">
                          Detected voice: <span className="font-semibold text-slate-800">{item.voice || "Compatible voice"}</span>
                        </p>
                        <button
                          onClick={() => void handleTest(item.lang)}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                          <Volume2 size={16} className={speakingLang === item.lang ? "animate-pulse" : ""} />
                          Test {item.language === "greek" ? "Greek" : "Hebrew"}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-sm leading-relaxed text-slate-600">
                          {item.language === "greek" ? "Greek" : "Hebrew"} text-to-speech requires a compatible {isWindows ? "Windows " : ""}{item.language === "greek" ? "Greek" : "Hebrew"} voice.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {isWindows ? (
                            <button
                              onClick={() => void handleOpenWindowsSettings("language", item.language)}
                              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                            >
                              <ExternalLink size={15} />
                              Open Windows Language Settings
                            </button>
                          ) : null}
                          <button
                            onClick={() => void loadTtsDiagnostics(true)}
                            disabled={ttsLoading}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                          >
                            <RefreshCw size={15} className={ttsLoading ? "animate-spin" : ""} />
                            Refresh Voice Detection
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {isWindows ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => void handleOpenWindowsSettings("language")}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      <ExternalLink size={16} />
                      Open Windows Language Settings
                    </button>
                    <button
                      onClick={() => void handleOpenWindowsSettings("speech")}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <ExternalLink size={16} />
                      Open Speech settings
                    </button>
                  </div>

                  {settingsOpenError ? (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
                      <AlertCircle size={18} className="mt-0.5 shrink-0" />
                      <span>{settingsOpenError} The manual instructions below remain available.</span>
                    </div>
                  ) : null}

                  <details open={settingsOpenError ? true : undefined} className="group rounded-xl border border-slate-200 bg-slate-50">
                    <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-900">
                      How to install Greek and Hebrew voices
                    </summary>
                    <div className="grid gap-6 border-t border-slate-200 px-5 py-5 text-sm leading-relaxed text-slate-700 lg:grid-cols-2">
                      <div>
                        <h6 className="font-bold text-slate-900">Windows 11</h6>
                        <ol className="mt-2 list-decimal space-y-1 pl-5">
                          <li>Click Open Windows Language Settings.</li>
                          <li>Under Preferred languages, select Add a language.</li>
                          <li>Search for Greek.</li>
                          <li>Select Greek and continue.</li>
                          <li>Install the language.</li>
                          <li>Open the options for Greek.</li>
                          <li>Under Language features, install Text-to-speech or Speech if available.</li>
                          <li>Repeat the process for Hebrew.</li>
                          <li>Wait for Windows to finish downloading the features.</li>
                          <li>Return to Rhelo.</li>
                          <li>Click Refresh Voice Detection.</li>
                          <li>If the voice still does not appear, close and reopen Rhelo.</li>
                        </ol>
                      </div>
                      <div>
                        <h6 className="font-bold text-slate-900">Windows 10</h6>
                        <ol className="mt-2 list-decimal space-y-1 pl-5">
                          <li>Click Open Windows Language Settings.</li>
                          <li>Select Add a preferred language.</li>
                          <li>Add Greek.</li>
                          <li>Open Greek language options.</li>
                          <li>Download the Speech/Text-to-speech component if available.</li>
                          <li>Repeat for Hebrew.</li>
                          <li>Return to Rhelo.</li>
                          <li>Click Refresh Voice Detection.</li>
                          <li>Restart Rhelo if detection has not updated.</li>
                        </ol>
                      </div>
                      <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-4 lg:col-span-2">
                        <p>Windows wording differs slightly across versions and editions. Internet access is required while Windows downloads the voice.</p>
                        <p>Some managed or work computers may block optional language features.</p>
                        <p>Rhelo does not change the Windows display language. Installing Greek or Hebrew speech does not require switching the Windows interface to that language.</p>
                        <p>Rhelo only reports a voice as ready after it detects a compatible installed voice.</p>
                      </div>
                    </div>
                  </details>
                </div>
              ) : null}
            </div>
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
