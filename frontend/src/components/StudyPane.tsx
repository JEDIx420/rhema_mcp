"use client";

import { useState, useEffect } from "react";
import { Loader2, MapPin, Volume2, ChevronLeft, ChevronRight, Plus, Notebook } from "lucide-react";
import { fetchVerseDetails, lookupLexicon, fetchOccurrences, fetchSessions, createSession, updateSession } from "@/lib/api";
import { getBookName } from "@/lib/books";

const addDateHeaderIfNeeded = (currentContent: string) => {
  const today = new Date();
  const dateString = today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const cleanContent = currentContent ? currentContent.trim() : "";
  if (!cleanContent.includes(dateString)) {
    const heading = `<h3 style="color: #2563eb; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${dateString}</h3>`;
    if (cleanContent === "" || cleanContent === "<p></p>" || cleanContent === "<h3></h3>") {
      return heading;
    } else {
      return cleanContent + heading;
    }
  }
  return currentContent;
};

interface MorphologyWord {
  word: string;
  lemma?: string;
  pos?: string;
  parse?: string;
}

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
  morphology: MorphologyWord[];
}

interface Commentary {
  commentary_id: string;
  text: string;
}

interface Place {
  name: string;
  latitude: number;
  longitude: number;
  type: string;
}

interface Event {
  title: string;
  year: number;
  location: string;
  description: string;
}

interface CrossReference {
  to_verse: string;
  votes: number;
  text_en?: string;
}

interface VerseDetail {
  verse: Verse;
  commentaries: Commentary[];
  places: Place[];
  events: Event[];
  cross_references: CrossReference[];
}

interface LexiconItem {
  strongs_id: string;
  lemma: string;
  definition: string;
}

interface Occurrence {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  text_en: string;
}

interface StudyPaneProps {
  verseId: string;
  onVerseClick?: (verseId: string) => void;
  initialTab?: "verse" | "lexicon";
  initialLexiconWord?: string | null;
}

// Transliteration Helpers
function transliterateGreek(text: string): string {
  if (!text) return "";
  const word = text.trim();
  let hasRoughBreathing = false;
  const roughBreathingChars = [
    'ἁ','ἃ','ἅ','ἇ','ἑ','ἓ','ἕ','ἡ','ἣ','ἥ','ἧ','ἱ','ἳ','ἵ','ἷ','ὁ','ὃ','ὅ','ὑ','ὓ','ὕ','ὗ','ὡ','ὣ','ὥ','ὧ',
    'Ἁ','Ἃ','Ἅ','Ἇ','Ἑ','Ἓ','Ἕ','Ἡ','Ἣ','Ἥ','Ἱ','Ἳ','Ὁ','ὃ','Ὅ','Ὑ','Ὓ','Ὕ','Ὗ','Ὡ','Ὓ','Ὥ','Ὗ',
    'ῥ','Ῥ'
  ];
  const normalized = word.normalize("NFD");
  if (normalized.includes("\u0314")) {
    hasRoughBreathing = true;
  } else {
    for (const char of roughBreathingChars) {
      if (word.startsWith(char)) {
        hasRoughBreathing = true;
        break;
      }
    }
  }
  const clean = normalized.replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const replacements: [RegExp, string][] = [
    [/ου/g, "oo"], [/ai/g, "eye"], [/ei/g, "ay"], [/oi/g, "oy"], [/ui/g, "wee"],
    [/au(?=[thkxpstphchps])/g, "af"], [/eu(?=[thkxpstphchps])/g, "ef"], [/au/g, "av"], [/eu/g, "ev"],
    [/gg/g, "ng"], [/gk/g, "nk"], [/gx/g, "nx"], [/gch/g, "nch"],
    [/a/g, "a"], [/b/g, "v"], [/g/g, "g"], [/d/g, "d"], [/e/g, "e"], [/z/g, "z"],
    [/e/g, "ay"], [/th/g, "th"], [/i/g, "i"], [/k/g, "k"], [/l/g, "l"], [/m/g, "m"],
    [/n/g, "n"], [/x/g, "x"], [/o/g, "o"], [/p/g, "p"], [/r/g, "r"], [/s/g, "s"],
    [/t/g, "t"], [/y/g, "y"], [/ph/g, "ph"], [/ch/g, "ch"], [/ps/g, "ps"], [/o/g, "o"]
  ];
  let phonetic = clean;
  for (const [regex, replacement] of replacements) {
    phonetic = phonetic.replace(regex, replacement);
  }
  if (hasRoughBreathing) {
    if (phonetic.startsWith("r")) {
      phonetic = "rh" + phonetic.slice(1);
    } else {
      phonetic = "h" + phonetic;
    }
  }
  return phonetic;
}

function transliterateHebrew(text: string): string {
  const map: Record<string, string> = {
    א: "'", ב: "b", ג: "g", ד: "d", ה: "h", ו: "w", ז: "z", ח: "ch", ט: "t",
    י: "y", כ: "k", ך: "k", ל: "l", מ: "m", ם: "m", נ: "n", ן: "n", ס: "s",
    ע: "'", פ: "p", ף: "p", צ: "ts", ץ: "ts", ק: "q", ר: "r", ש: "sh", ת: "t"
  };
  const clean = text.replace(/[\u0591-\u05C7]/g, "");
  return clean.split("").map(char => map[char] || char).join("");
}

function getTransliteration(text: string): string {
  if (!text) return "";
  let isHebrew = false;
  let isGreek = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0590 && code <= 0x05ff) isHebrew = true;
    if ((code >= 0x0370 && code <= 0x03ff) || (code >= 0x1f00 && code <= 0x1fff)) isGreek = true;
  }
  if (isHebrew) return transliterateHebrew(text);
  if (isGreek) return transliterateGreek(text);
  return "";
}

export default function StudyPane({ verseId, onVerseClick, initialTab, initialLexiconWord }: StudyPaneProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verseData, setVerseData] = useState<VerseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"verse" | "lexicon" | "sessions">("lexicon"); // default active to lexicon always!
  const [activeLexiconWord, setActiveLexiconWord] = useState<string | null>(null);

  interface StudyPaneSession {
    session_id: string;
    title: string;
    content: string;
    updated_at: string;
  }

  // Sessions log states
  const [studySessions, setStudySessions] = useState<StudyPaneSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [quickNote, setQuickNote] = useState("");

  const loadStudyPaneSessions = async () => {
    Promise.resolve().then(() => {
      setSessionsLoading(true);
    });
    try {
      const res = await fetchSessions();
      const list = res.sessions || [];
      setStudySessions(list);
      if (list.length > 0) {
        if (selectedSessionId && list.some((s: any) => s.session_id === selectedSessionId)) {
          // Keep current selection
        } else {
          setSelectedSessionId(list[0].session_id);
          window.dispatchEvent(new CustomEvent("targum-active-session-changed", {
            detail: { sessionId: list[0].session_id, title: list[0].title }
          }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleCreateSessionInPane = async () => {
    if (!newSessionTitle.trim()) return;
    try {
      const today = new Date();
      const dateString = today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const initialContent = `<h3 style="color: #2563eb; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${dateString}</h3><p></p>`;
      const res = await createSession(newSessionTitle.trim(), initialContent);
      setNewSessionTitle("");
      await loadStudyPaneSessions();
      setSelectedSessionId(res.session_id);
      window.dispatchEvent(new CustomEvent("targum-active-session-changed", {
        detail: { sessionId: res.session_id, title: res.title || newSessionTitle.trim() }
      }));
      window.dispatchEvent(new CustomEvent("targum-session-updated"));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddQuickNote = async () => {
    if (!selectedSessionId || !quickNote.trim()) return;
    const active = studySessions.find(s => s.session_id === selectedSessionId);
    if (!active) return;
    try {
      const contentWithDate = addDateHeaderIfNeeded(active.content || "");
      const timestamp = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
      const noteHtml = `<p><strong>[${timestamp}]</strong>: ${quickNote.trim()}</p>`;
      const updatedContent = contentWithDate + noteHtml;
      await updateSession(selectedSessionId, active.title, updatedContent);
      setQuickNote("");
      await loadStudyPaneSessions();
      window.dispatchEvent(new CustomEvent("targum-session-updated"));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === "sessions") {
      Promise.resolve().then(() => {
        loadStudyPaneSessions();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const handleSessionUpdated = () => {
      if (activeTab === "sessions") {
        Promise.resolve().then(() => {
          loadStudyPaneSessions();
        });
      }
    };
    window.addEventListener("targum-session-updated", handleSessionUpdated);
    return () => window.removeEventListener("targum-session-updated", handleSessionUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const handleActiveSessionChanged = (e: any) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const sid = customEvent.detail.sessionId;
        if (selectedSessionId !== sid) {
          setSelectedSessionId(sid);
        }
      }
    };
    window.addEventListener("targum-active-session-changed", handleActiveSessionChanged as any);
    return () => window.removeEventListener("targum-active-session-changed", handleActiveSessionChanged as any);
  }, [selectedSessionId]);

  const handleStudyPaneDragStart = (e: React.DragEvent, id: string, text: string) => {
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.setData("application/verse-id", id);
    e.dataTransfer.effectAllowed = "copy";
    const dragEvent = new CustomEvent("targum-drag-start", { detail: { verseId: id, verseText: text } });
    window.dispatchEvent(dragEvent);
  };

  const handleStudyPaneDragEnd = () => {
    const dragEndEvent = new CustomEvent("targum-drag-end");
    window.dispatchEvent(dragEndEvent);
  };

  // Lexicon states
  const [lexiconData, setLexiconData] = useState<LexiconItem[]>([]);
  const [lexiconLoading, setLexiconLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);

  const loadLexicon = async (word: string) => {
    setLexiconLoading(true);
    setOccurrencesLoading(true);
    try {
      const data = await lookupLexicon(word);
      setLexiconData(data.results || []);
      const occData = await fetchOccurrences(word);
      setOccurrences(occData.occurrences || []);
    } catch {
      setLexiconData([]);
      setOccurrences([]);
    } finally {
      setLexiconLoading(false);
      setOccurrencesLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchVerseDetails(verseId);
        if (!cancelled) {
          setVerseData(data);
          setActiveTab(initialTab || "lexicon");
          
          if (initialLexiconWord) {
            setActiveLexiconWord(initialLexiconWord);
            // Must fetch lexicon details for the initial word
            setLexiconLoading(true);
            setOccurrencesLoading(true);
            try {
              const lexData = await lookupLexicon(initialLexiconWord);
              setLexiconData(lexData.results || []);
              const occData = await fetchOccurrences(initialLexiconWord);
              setOccurrences(occData.occurrences || []);
            } catch {
              setLexiconData([]);
              setOccurrences([]);
            } finally {
              setLexiconLoading(false);
              setOccurrencesLoading(false);
            }
          } else {
            // If morphology is available, select the first word automatically
            const morphWords = data.verse?.morphology || [];
            if (morphWords.length > 0) {
              const firstWord = morphWords[0];
              setActiveLexiconWord(firstWord.lemma || firstWord.word);
              // Must fetch lexicon details for the first word
              setLexiconLoading(true);
              setOccurrencesLoading(true);
              try {
                const lexData = await lookupLexicon(firstWord.lemma || firstWord.word);
                setLexiconData(lexData.results || []);
                const occData = await fetchOccurrences(firstWord.lemma || firstWord.word);
                setOccurrences(occData.occurrences || []);
              } catch {
                setLexiconData([]);
                setOccurrences([]);
              } finally {
                setLexiconLoading(false);
                setOccurrencesLoading(false);
              }
            } else {
              // Extract first word from text_original as fallback
              const rawWords = (data.verse?.text_original || "").split(/\s+/);
              const cleanWords = rawWords.map((w: string) => w.replace(/[.,;:!?׃.-]/g, "").trim()).filter(Boolean);
              if (cleanWords.length > 0) {
                const firstWord = cleanWords[0];
                setActiveLexiconWord(firstWord);
                setLexiconLoading(true);
                setOccurrencesLoading(true);
                try {
                  const lexData = await lookupLexicon(firstWord);
                  setLexiconData(lexData.results || []);
                  const occData = await fetchOccurrences(firstWord);
                  setOccurrences(occData.occurrences || []);
                } catch {
                  setLexiconData([]);
                  setOccurrences([]);
                } finally {
                  setLexiconLoading(false);
                  setOccurrencesLoading(false);
                }
              } else {
                setActiveLexiconWord(null);
                setActiveTab(initialTab || "verse");
              }
            }
          }
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load study details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [verseId, initialTab, initialLexiconWord]);

  const handleLexiconWordSelect = (word: string) => {
    setActiveLexiconWord(word);
    loadLexicon(word);
  };

  const speakWord = (word: string, isGreek: boolean) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = isGreek ? "el-GR" : "he-IL";
      window.speechSynthesis.speak(utterance);
    }
  };

  const handlePlayAudio = (lemma: string) => {
    const isOT = verseId.startsWith("GEN") || verseId.startsWith("EXO") || verseId.startsWith("LEV") || verseId.startsWith("NUM") || verseId.startsWith("DEU") || verseId.startsWith("JOS") || verseId.startsWith("JDG") || verseId.startsWith("RUT") || verseId.startsWith("1SA") || verseId.startsWith("2SA") || verseId.startsWith("1KI") || verseId.startsWith("2KI") || verseId.startsWith("1CH") || verseId.startsWith("2CH") || verseId.startsWith("EZR") || verseId.startsWith("NEH") || verseId.startsWith("EST") || verseId.startsWith("JOB") || verseId.startsWith("PSA") || verseId.startsWith("PRO") || verseId.startsWith("ECC") || verseId.startsWith("SNG") || verseId.startsWith("ISA") || verseId.startsWith("JER") || verseId.startsWith("LAM") || verseId.startsWith("EZK") || verseId.startsWith("DAN") || verseId.startsWith("HOS") || verseId.startsWith("JOL") || verseId.startsWith("AMO") || verseId.startsWith("OBD") || verseId.startsWith("JON") || verseId.startsWith("MIC") || verseId.startsWith("NAM") || verseId.startsWith("HAB") || verseId.startsWith("ZEP") || verseId.startsWith("HAG") || verseId.startsWith("ZEC") || verseId.startsWith("MAL");
    speakWord(lemma, !isOT);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white h-full">
        <Loader2 size={32} className="animate-spin text-blue-500 mb-2" />
        <span className="text-sm text-slate-500 font-sans">Loading exegesis resources...</span>
      </div>
    );
  }

  if (error || !verseData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white h-full font-sans text-center">
        <p className="text-red-500 font-medium">{error || "No data available."}</p>
      </div>
    );
  }

  const rawOriginalWords = (verseData.verse?.text_original || "").split(/\s+/);
  const cleanOriginalWords = rawOriginalWords.map((w: string) => w.replace(/[.,;:!?׃.-]/g, "").trim()).filter(Boolean);
  const morphWords = verseData.verse?.morphology && verseData.verse.morphology.length > 0
    ? verseData.verse.morphology
    : cleanOriginalWords.map((w: string) => ({ word: w, lemma: w }));
  const activeWordIndex = morphWords.findIndex(
    (m) => m.lemma === activeLexiconWord || m.word === activeLexiconWord
  );
  const hasMultipleWords = morphWords.length > 1;

  const cycleWord = (direction: number) => {
    if (morphWords.length === 0) return;
    let newIndex = activeWordIndex + direction;
    if (newIndex < 0) newIndex = morphWords.length - 1;
    else if (newIndex >= morphWords.length) newIndex = 0;
    const nextWord = morphWords[newIndex];
    handleLexiconWordSelect(nextWord.lemma || nextWord.word);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header Tabs */}
      <div className="flex border-b border-slate-200 text-sm font-semibold bg-slate-50 shrink-0">
        <button
          onClick={() => setActiveTab("verse")}
          className={`flex-1 py-4 text-center border-b-2 font-sans transition-all cursor-pointer ${
            activeTab === "verse"
              ? "text-blue-600 border-blue-600 font-bold"
              : "text-slate-500 border-transparent hover:text-slate-850"
          }`}
          style={{ color: activeTab === "verse" ? "#2563eb" : undefined, borderColor: activeTab === "verse" ? "#2563eb" : undefined }}
        >
          VERSE STUDY
        </button>
        {activeLexiconWord && (
          <button
            onClick={() => setActiveTab("lexicon")}
            className={`flex-1 py-4 text-center border-b-2 font-sans transition-all cursor-pointer ${
              activeTab === "lexicon"
                ? "text-blue-600 border-blue-600 font-bold"
                : "text-slate-500 border-transparent hover:text-slate-850"
            }`}
            style={{ color: activeTab === "lexicon" ? "#2563eb" : undefined, borderColor: activeTab === "lexicon" ? "#2563eb" : undefined }}
          >
            LEXICON
          </button>
        )}
        <button
          onClick={() => setActiveTab("sessions")}
          className={`flex-1 py-4 text-center border-b-2 font-sans transition-all cursor-pointer ${
            activeTab === "sessions"
              ? "text-blue-600 border-blue-600 font-bold"
              : "text-slate-500 border-transparent hover:text-slate-850"
          }`}
          style={{ color: activeTab === "sessions" ? "#2563eb" : undefined, borderColor: activeTab === "sessions" ? "#2563eb" : undefined }}
        >
          SESSIONS
        </button>
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "verse" && (
          <div className="space-y-6">
            <div>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {verseData.verse.id}
              </span>
              <h3 className="text-xl font-bold font-sans text-slate-900 mt-2">
                {getBookName(verseData.verse.book)} {verseData.verse.chapter}:{verseData.verse.verse}
              </h3>
            </div>

            {/* Commentary */}
            {verseData.commentaries.length > 0 ? (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5 text-slate-500 font-sans">
                  Matthew Henry Commentary
                </h4>
                {verseData.commentaries.map((c, i) => (
                  <p
                    key={i}
                    draggable
                    onDragStart={(e) => handleStudyPaneDragStart(e, `Commentary: ${verseId}`, c.text)}
                    onDragEnd={handleStudyPaneDragEnd}
                    className="text-[16px] leading-relaxed p-4 rounded-xl border border-slate-200 bg-slate-55 text-slate-700 font-prose whitespace-pre-line mb-3 cursor-grab active:cursor-grabbing"
                  >
                    {c.text}
                  </p>
                ))}
              </div>
            ) : (
              <div className="text-sm italic p-4 text-center text-slate-500 border border-slate-100 rounded-xl">
                No commentaries available for this verse.
              </div>
            )}

            {/* Cross References */}
            {verseData.cross_references.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-slate-500 font-sans">
                  Theological Cross References
                </h4>
                <div className="flex flex-col gap-3">
                  {verseData.cross_references.map((cr) => (
                    <div
                      key={cr.to_verse}
                      draggable
                      onDragStart={(e) => handleStudyPaneDragStart(e, cr.to_verse, cr.text_en || "")}
                      onDragEnd={handleStudyPaneDragEnd}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col gap-2 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between w-full">
                        <button
                          onClick={() => onVerseClick?.(cr.to_verse)}
                          className="font-bold text-blue-600 hover:underline cursor-pointer text-left text-sm font-sans"
                        >
                          {cr.to_verse}
                        </button>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {cr.votes} votes
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-700 italic font-prose">
                        &ldquo;{cr.text_en || "Verse text not available"}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Places */}
            {verseData.places.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-slate-500 font-sans">
                  Geocoded Locations
                </h4>
                <div className="flex flex-col gap-2">
                  {verseData.places.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white shadow-xs text-sm"
                    >
                      <MapPin size={15} className="text-purple-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-900 font-sans block truncate">{p.name}</span>
                        <span className="text-[11px] block text-slate-500 font-sans truncate">{p.type}</span>
                      </div>
                      <span className="ml-auto font-mono text-[10px] text-slate-400 shrink-0">
                        {p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Events */}
            {verseData.events.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-slate-500 font-sans">
                  Chronological Events
                </h4>
                {verseData.events.map((e, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs mb-3"
                  >
                    <div className="text-sm font-bold text-slate-900 font-sans">{e.title}</div>
                    <div className="text-[11px] text-blue-600 font-bold mt-1 font-sans">
                      Year {e.year < 0 ? `${Math.abs(e.year)} BC` : `AD ${e.year}`} • {e.location}
                    </div>
                    {e.description && (
                      <p className="text-sm leading-relaxed text-slate-750 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200 font-prose">{e.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "lexicon" && activeLexiconWord && (
          <div className="space-y-6">
            {/* Word Cycler */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 shadow-xs shrink-0">
              <button
                onClick={() => cycleWord(-1)}
                disabled={!hasMultipleWords}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs animate-none"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="text-center flex-1 mx-2">
                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-sans font-bold mb-0.5">
                  Verse Word {activeWordIndex !== -1 ? `${activeWordIndex + 1} of ${morphWords.length}` : ""}
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-xl font-serif font-bold text-slate-900 leading-normal">
                    {activeWordIndex !== -1 ? morphWords[activeWordIndex].word : activeLexiconWord}
                  </span>
                  <button
                    onClick={() => handlePlayAudio(activeWordIndex !== -1 ? (morphWords[activeWordIndex].lemma || morphWords[activeWordIndex].word) : activeLexiconWord)}
                    className="p-0.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <Volume2 size={13} />
                  </button>
                </div>
                {activeWordIndex !== -1 && morphWords[activeWordIndex].lemma && (
                  <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                    Lemma: <span className="font-semibold text-slate-700">{morphWords[activeWordIndex].lemma}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => cycleWord(1)}
                disabled={!hasMultipleWords}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs animate-none"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Definitions */}
            <div>
              <h3 className="text-sm font-bold font-sans text-slate-900 mb-3">
                Strong&apos;s Definitions
              </h3>
              {lexiconLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                </div>
              ) : lexiconData.length > 0 ? (
                <div className="space-y-3">
                  {lexiconData.map((item, idx) => (
                    <div key={idx} className="border border-slate-200 bg-white p-4 rounded-xl shadow-xs space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {item.strongs_id}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{item.lemma}</span>
                        {getTransliteration(item.lemma) && (
                          <span className="text-[10px] text-sky-600 font-mono italic">
                            ({getTransliteration(item.lemma)})
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-150 font-serif">
                        {item.definition}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs italic text-center py-6 text-slate-500">
                  No Strong&apos;s definitions found.
                </div>
              )}
            </div>

            {/* Occurrences */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">
                Occurrences in Scripture
              </h4>
              {occurrencesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              ) : occurrences.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {occurrences.slice(0, 15).map((o) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(e) => handleStudyPaneDragStart(e, o.id, o.text_en)}
                      onDragEnd={handleStudyPaneDragEnd}
                      onClick={() => onVerseClick?.(o.id)}
                      className="text-left p-3.5 rounded-lg border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50 transition-all cursor-grab active:cursor-grabbing shadow-xs block w-full"
                    >
                      <div className="font-semibold text-blue-600 text-xs font-sans mb-1">
                        {getBookName(o.book)} {o.chapter}:{o.verse}
                      </div>
                      <div className="text-slate-700 text-xs leading-relaxed font-prose line-clamp-2">{o.text_en}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs italic text-center py-6 text-slate-500">
                  No other occurrences found.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="space-y-4 flex flex-col h-full min-h-0">
            {/* Active Log Select dropdown */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                Active Study Log
              </label>
              <select
                value={selectedSessionId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSessionId(val);
                  const matched = studySessions.find(s => s.session_id === val);
                  if (matched) {
                    window.dispatchEvent(new CustomEvent("targum-active-session-changed", {
                      detail: { sessionId: val, title: matched.title }
                    }));
                  }
                }}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm cursor-pointer font-sans"
              >
                {studySessions.length === 0 ? (
                  <option value="">No sessions available</option>
                ) : (
                  studySessions.map((s) => (
                    <option key={s.session_id} value={s.session_id}>
                      {s.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Quick Session Create */}
            <div className="flex gap-2 shrink-0">
              <input
                type="text"
                placeholder="New log title..."
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSessionInPane();
                }}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans"
              />
              <button
                onClick={handleCreateSessionInPane}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 py-2 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 shrink-0 font-sans"
              >
                <Plus size={13} />
                <span>Create</span>
              </button>
            </div>

            {/* Preview of active session content */}
            {sessionsLoading ? (
              <div className="flex-1 flex items-center justify-center py-10 shrink-0">
                <Loader2 size={20} className="animate-spin text-blue-500" />
              </div>
            ) : selectedSessionId ? (
              <div className="flex-1 flex flex-col min-h-[220px] bg-slate-50 rounded-xl border border-slate-200/60 p-4 overflow-y-auto">
                <div className="font-extrabold text-sm text-slate-900 border-b border-slate-200/50 pb-2 mb-2 flex items-center gap-1.5 font-sans">
                  <Notebook size={14} className="text-blue-500" />
                  <span>{studySessions.find(s => s.session_id === selectedSessionId)?.title}</span>
                </div>
                <div
                  className="text-slate-700 text-sm leading-relaxed prose prose-sm font-sans flex-1 overflow-y-auto"
                  dangerouslySetInnerHTML={{
                    __html: studySessions.find(s => s.session_id === selectedSessionId)?.content || "<p class='text-slate-400 italic font-sans'>No notes logged in this session yet. Drag scripture verses or type a note below!</p>"
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs italic font-sans min-h-[150px]">
                Create a study log to start taking exegesis notes.
              </div>
            )}

            {/* Quick Note Add */}
            {selectedSessionId && (
              <div className="flex gap-2 shrink-0 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  placeholder="Type a quick study note..."
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddQuickNote();
                  }}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans"
                />
                <button
                  onClick={handleAddQuickNote}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0 font-sans"
                >
                  Add Note
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
