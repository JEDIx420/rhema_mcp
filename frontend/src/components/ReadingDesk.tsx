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
  Volume2,
  Copy,
  ExternalLink,
  Check,
  Plus,
} from "lucide-react";
import { fetchChapter, fetchVerseDetails, lookupLexicon, fetchOccurrences } from "@/lib/api";
import { BIBLE_BOOKS, getBookName } from "@/lib/books";
import BookChapterPickerModal from "./BookChapterPickerModal";
import StudyPane from "./StudyPane";

const BIBLE_CHAPTER_COUNTS: Record<string, number> = {
  GEN: 50, EXO: 40, LEV: 27, NUM: 36, DEU: 34, JOS: 24, JDG: 21, RUT: 4,
  "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36,
  EZR: 10, NEH: 13, EST: 10, JOB: 42, PSA: 150, PRO: 31, ECC: 12, SNG: 8,
  ISA: 66, JER: 52, LAM: 5, EZK: 48, DAN: 12, HOS: 14, JOL: 3, AMO: 9,
  OBD: 1, JON: 4, MIC: 7, NAM: 3, HAB: 3, ZEP: 3, HAG: 2, ZEC: 14, MAL: 4,
  MAT: 28, MRK: 16, LUK: 24, JHN: 21, ACT: 28, ROM: 16, "1CO": 16, "2CO": 13,
  GAL: 6, EPH: 6, PHP: 4, COL: 4, "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4,
  TIT: 3, PHM: 1, HEB: 13, JAS: 5, "1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1,
  "3JN": 1, JUD: 1, REV: 22
};

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
  morphology: any[];
}

interface VerseDetail {
  verse: Verse;
  commentaries: { commentary_id: string; text: string }[];
  places: { name: string; latitude: number; longitude: number; type: string }[];
  events: { title: string; year: number; location: string; description: string }[];
  cross_references: { to_verse: string; votes: number; text_en?: string }[];
}

interface HoveredWordInfo {
  word: string;
  lemma?: string;
  pos?: string;
  parse?: string;
  x: number;
  y: number;
  definition?: string;
  strongsId?: string;
}

interface VerseMenuInfo {
  verseId: string;
  verseText: string;
  x: number;
  y: number;
}

function transliterateGreek(text: string): string {
  if (!text) return "";
  let word = text.trim();
  
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

  let clean = normalized.replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const replacements: [RegExp, string][] = [
    [/ου/g, "oo"],
    [/αι/g, "eye"],
    [/ει/g, "ay"],
    [/οι/g, "oy"],
    [/υι/g, "wee"],
    [/αυ(?=[θκξπστφχψ])/g, "af"],
    [/ευ(?=[θκξπστφχψ])/g, "ef"],
    [/αυ/g, "av"],
    [/ευ/g, "ev"],
    [/γγ/g, "ng"],
    [/γκ/g, "nk"],
    [/γξ/g, "nx"],
    [/γχ/g, "nch"],
    [/α/g, "a"],
    [/β/g, "v"],
    [/γ/g, "g"],
    [/δ/g, "d"],
    [/ε/g, "e"],
    [/ζ/g, "z"],
    [/η/g, "ay"],
    [/θ/g, "th"],
    [/ι/g, "i"],
    [/κ/g, "k"],
    [/λ/g, "l"],
    [/μ/g, "m"],
    [/ν/g, "n"],
    [/ξ/g, "x"],
    [/ο/g, "o"],
    [/π/g, "p"],
    [/ρ/g, "r"],
    [/σ/g, "s"],
    [/ς/g, "s"],
    [/τ/g, "t"],
    [/υ/g, "y"],
    [/φ/g, "ph"],
    [/χ/g, "ch"],
    [/ψ/g, "ps"],
    [/ω/g, "o"]
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

const GREEK_NAME_MAP: Record<string, string> = {
  "jesus": "iesous",
  "christ": "christos",
  "god": "theos",
  "beginning": "arche",
  "word": "logos",
  "light": "phos",
  "darkness": "skotia",
  "life": "zoe",
  "witness": "martyria",
  "man": "anthropos",
  "believe": "pisteuo",
  "world": "kosmos",
  "grace": "charis",
  "truth": "aletheia",
  "full": "pleres",
  "son": "huios",
  "brother": "adelphos",
  "sister": "adelphe",
  "faith": "pistis",
  "law": "nomos",
  "sin": "hamartia",
  "heaven": "ouranos",
  "earth": "ge",
  "disciple": "mathetes",
  "apostle": "apostolos",
  "church": "ekklesia",
  "david": "dauid",
  "abraham": "abraam",
  "moses": "mouses",
  "israel": "israel",
  "peter": "petros",
  "john": "ioannes",
  "covenant": "diatheke",
  "mercy": "eleos",
  "peace": "eirene",
  "joy": "chara",
  "hope": "elpis",
  "name": "onoma",
  "great": "megas",
  "good": "agathos",
  "all": "pas",
  "one": "heis",
  "many": "polys",
  "first": "protos",
  "new": "kainos",
  "old": "palaios"
};

const HEBREW_NAME_MAP: Record<string, string> = {
  "god": "elohim",
  "lord": "yahweh",
  "created": "bara",
  "beginning": "reshith",
  "heaven": "shamayim",
  "earth": "erets",
  "light": "or",
  "darkness": "choshek",
  "day": "yom",
  "night": "laylah",
  "water": "mayim",
  "waters": "mayim",
  "spirit": "ruach",
  "man": "adam",
  "woman": "ishshah",
  "son": "ben",
  "daughter": "bath",
  "father": "ab",
  "mother": "em",
  "brother": "ach",
  "sister": "achoth",
  "king": "melek",
  "covenant": "berith",
  "peace": "shalom",
  "love": "ahab",
  "truth": "emeth",
  "holy": "qodesh",
  "deep": "tehom",
  "void": "bohu",
  "form": "tohu",
  "without": "tohu",
  "abyss": "tehom",
  "divided": "badal",
  "firmament": "raqiya",
  "land": "erets",
  "dry": "yabashah",
  "seas": "yam",
  "saw": "raah",
  "good": "towb"
};

function isWordMatch(engWord: string, originalLemma: string, isOT: boolean): boolean {
  const cleanEng = engWord.toLowerCase().replace(/[^a-z]/g, "");
  if (!cleanEng || cleanEng.length < 2) return false;

  const stopWords = new Set(["the", "and", "of", "to", "in", "a", "an", "is", "that", "it", "he", "she", "they", "we", "you", "his", "her", "their", "our", "your", "him", "them", "us", "me", "my", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "for", "with", "as", "by", "on", "at", "from", "but", "or", "so", "if", "than", "then", "there", "their", "this", "these", "those", "is", "are", "was", "were"]);
  if (stopWords.has(cleanEng)) return false;

  let translit = getTransliteration(originalLemma).toLowerCase().replace(/[^a-z]/g, "");
  if (!translit) return false;

  const map = isOT ? HEBREW_NAME_MAP : GREEK_NAME_MAP;
  const mapped = map[cleanEng] || cleanEng;

  // Helper to remove vowels for sound-alike root matching
  const stripVowels = (str: string) => str.replace(/[aeiouy]/g, "");
  const vTranslit = stripVowels(translit);
  const vMapped = stripVowels(mapped);

  if (isOT) {
    const prefixes = ["w", "h", "b", "l", "k", "m"];
    for (const p of prefixes) {
      if (translit.startsWith(p) && translit.length > p.length + 1) {
        const sub = translit.slice(p.length);
        const vSub = stripVowels(sub);
        if (sub === mapped || sub.startsWith(mapped) || mapped.startsWith(sub)) return true;
        if (vSub === vMapped || vSub.startsWith(vMapped) || vMapped.startsWith(vSub)) return true;
        
        for (const p2 of prefixes) {
          if (sub.startsWith(p2) && sub.length > p2.length + 1) {
            const sub2 = sub.slice(p2.length);
            const vSub2 = stripVowels(sub2);
            if (sub2 === mapped || sub2.startsWith(mapped) || mapped.startsWith(sub2)) return true;
            if (vSub2 === vMapped || vSub2.startsWith(vMapped) || vMapped.startsWith(vSub2)) return true;
          }
        }
      }
    }
  }

  if (translit === mapped || vTranslit === vMapped) return true;
  if ((translit.startsWith(mapped) || vTranslit.startsWith(vMapped)) && mapped.length >= 2) return true;
  if ((mapped.startsWith(translit) || vMapped.startsWith(vTranslit)) && translit.length >= 2) return true;
  if (translit.includes(mapped) && mapped.length >= 3) return true;
  if (mapped.includes(translit) && translit.length >= 3) return true;

  if (translit.substring(0, 4) === mapped.substring(0, 4) && mapped.length >= 4) return true;

  return false;
}

const TRANSLATIONS = [
  { key: "text_en", label: "English (KJV)", enabled: true },
  { key: "text_original", label: "Original (Heb/Grk)", enabled: true },
  { key: "text_hi", label: "Hindi", enabled: false },
  { key: "text_te", label: "Telugu", enabled: false },
  { key: "text_ml", label: "Malayalam", enabled: false },
  { key: "text_ta", label: "Tamil", enabled: false },
];

interface ReadingDeskProps {
  book?: string;
  chapter?: number;
  setBook?: (book: string) => void;
  setChapter?: (chapter: number) => void;
  selectedVerseId?: string | null;
  setSelectedVerseId?: (id: string | null) => void;
  onViewChange?: (view: string) => void;
  onMapNavigate?: (center: [number, number]) => void;
}

export default function ReadingDesk(props: ReadingDeskProps) {
  const [localBook, setLocalBook] = useState("GEN");
  const [localChapter, setLocalChapter] = useState(1);

  const book = props.book || localBook;
  const setBook = props.setBook || setLocalBook;
  const chapter = props.chapter || localChapter;
  const setChapter = props.setChapter || setLocalChapter;

  type FetchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "success"; verses: Verse[] };

  const [fetchState, setFetchState] = useState<FetchState>({ status: "loading" });
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [textSize, setTextSize] = useState(17);
  const [enabledTranslations, setEnabledTranslations] = useState(
    TRANSLATIONS.map((t) => ({ ...t }))
  );
  
  // Exegesis Drawer States
  const [selectedVerse, setSelectedVerse] = useState<VerseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [studyInitialTab, setStudyInitialTab] = useState<"verse" | "lexicon">("verse");
  const [studyInitialWord, setStudyInitialWord] = useState<string | null>(null);


  const [speakingKey, setSpeakingKey] = useState<string | null>(null);

  const handleSpeakText = async (text: string, langCode: string, key: string) => {
    try {
      setSpeakingKey(key);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
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

  const handleDragStart = (e: React.DragEvent, verseId: string, verseText: string) => {
    e.dataTransfer.setData("text/plain", verseText);
    e.dataTransfer.setData("application/verse-id", verseId);
    e.dataTransfer.effectAllowed = "copy";
    const dragEvent = new CustomEvent("rhema-drag-start", { detail: { verseId, verseText } });
    window.dispatchEvent(dragEvent);
  };

  const handleDragEnd = () => {
    const dragEndEvent = new CustomEvent("rhema-drag-end");
    window.dispatchEvent(dragEndEvent);
  };

  // Modal Lexicon state (used when clicking word from reader body)
  const [selectedLexiconModalWord, setSelectedLexiconModalWord] = useState<any | null>(null);

  // Interaction UI States
  const [hoveredWord, setHoveredWord] = useState<HoveredWordInfo | null>(null);
  const [hoveredEnglishWord, setHoveredEnglishWord] = useState<{
    word: string;
    verseId: string;
    matchedOriginal: string | null;
  } | null>(null);
  const [verseMenu, setVerseMenu] = useState<VerseMenuInfo | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const definitionCache = useRef<Record<string, any>>({});
  const loadChapterRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadChapterRef.current?.abort();
    const controller = new AbortController();
    loadChapterRef.current = controller;
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setFetchState({ status: "loading" });
        if (!props.selectedVerseId) {
          setSelectedVerse(null);
        }
      }
    });

    fetchChapter(book, chapter)
      .then((data) => {
        if (!cancelled) {
          setFetchState({ status: "success", verses: data.verses || [] });
          // If a specific verse needs to be highlighted/selected
          if (props.selectedVerseId) {
            handleVerseClick(props.selectedVerseId);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchState({
            status: "error",
            message: `Failed to load ${getBookName(book)} ${chapter}. Is the backend server running on port 5050?`,
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [book, chapter, retryKey]);

  useEffect(() => {
    if (props.selectedVerseId) {
      handleVerseClick(props.selectedVerseId);
    }
  }, [props.selectedVerseId]);

  const loading = fetchState.status === "loading";
  const error = fetchState.status === "error" ? fetchState.message : null;
  const verses = fetchState.status === "success" ? fetchState.verses : [];

  const handleVerseClick = async (verseId: string) => {
    setLoadingDetail(true);
    if (props.setSelectedVerseId) props.setSelectedVerseId(verseId);
    try {
      const data = await fetchVerseDetails(verseId);
      setSelectedVerse(data);
      setStudyInitialTab("verse");
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  };

  const navigateChapter = (direction: number) => {
    const bookIdx = BIBLE_BOOKS.findIndex((b) => b.code === book);
    if (bookIdx === -1) return;

    if (direction === -1) {
      if (chapter === 1) {
        if (bookIdx > 0) {
          const prevBook = BIBLE_BOOKS[bookIdx - 1].code;
          setBook(prevBook);
          setChapter(BIBLE_CHAPTER_COUNTS[prevBook] || 1);
        }
      } else {
        setChapter(chapter - 1);
      }
    } else if (direction === 1) {
      const maxChapters = BIBLE_CHAPTER_COUNTS[book] || 1;
      if (chapter === maxChapters) {
        if (bookIdx < BIBLE_BOOKS.length - 1) {
          const nextBook = BIBLE_BOOKS[bookIdx + 1].code;
          setBook(nextBook);
          setChapter(1);
        }
      } else {
        setChapter(chapter + 1);
      }
    }
  };

  const toggleTranslation = (key: string) => {
    setEnabledTranslations((prev) =>
      prev.map((t) => (t.key === key ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const activeTranslations = enabledTranslations.filter((t) => t.enabled);

  // Audio synthesis helper
  const speakWord = async (word: string, isGreek: boolean) => {
    try {
      const langCode = isGreek ? "el" : "he";
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
      const res = await fetch(`${apiBase}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word, language_code: langCode })
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error("speakWord failed, falling back to window.speechSynthesis", err);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = isGreek ? "el-GR" : "he-IL";
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handlePlayAudio = (lemma: string) => {
    const isGreek = BIBLE_BOOKS.find((b) => b.code === book)?.testament === "NT";
    speakWord(lemma, isGreek);
  };

  // Word Hover / Lexicon fetch
  const handleWordHover = async (word: string, lemma?: string) => {
    const query = lemma || word;
    if (!query) return;

    if (definitionCache.current[query]) {
      return;
    }

    try {
      const data = await lookupLexicon(query);
      if (data.results && data.results.length > 0) {
        definitionCache.current[query] = {
          definition: data.results[0].definition,
          strongsId: data.results[0].strongs_id,
          lemma: data.results[0].lemma,
        };
        setHoveredWord((prev) => {
          if (prev && (prev.lemma === query || prev.word === query)) {
            return {
              ...prev,
              definition: data.results[0].definition,
              strongsId: data.results[0].strongs_id,
            };
          }
          return prev;
        });
      } else {
        definitionCache.current[query] = {
          definition: "No definition found in lexicon.",
          strongsId: "—",
          lemma: query,
        };
        setHoveredWord((prev) => {
          if (prev && (prev.lemma === query || prev.word === query)) {
            return {
              ...prev,
              definition: "No definition found in lexicon.",
              strongsId: "—",
            };
          }
          return prev;
        });
      }
    } catch (e) {
      console.error(e);
      setHoveredWord((prev) => {
        if (prev && (prev.lemma === query || prev.word === query)) {
          return {
            ...prev,
            definition: "Error loading definition.",
            strongsId: "—",
          };
        }
        return prev;
      });
    }
  };

  const handleOriginalWordMouseEnter = (
    e: React.MouseEvent,
    word: string,
    lemma?: string,
    pos?: string,
    parse?: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const info: HoveredWordInfo = {
      word,
      lemma,
      pos,
      parse,
      x: rect.left,
      y: rect.top,
      definition: definitionCache.current[lemma || word]?.definition,
      strongsId: definitionCache.current[lemma || word]?.strongsId,
    };
    setHoveredWord(info);
    handleWordHover(word, lemma);
  };

  const handleOriginalWordMouseLeave = () => {
    setHoveredWord(null);
  };

  const handleOriginalWordClick = async (word: string, lemma?: string) => {
    const query = lemma || word;
    setStudyInitialWord(query);
    setStudyInitialTab("lexicon");

    try {
      const data = await lookupLexicon(query);
      const results = data.results || [];
      if (results.length > 0) {
        setSelectedLexiconModalWord(results[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Render individual word in original language columns
  const renderOriginalText = (v: Verse) => {
    const isGreek =
      BIBLE_BOOKS.find((b) => b.code === v.book)?.testament === "NT";

    const hasMorph = v.morphology && v.morphology.length > 0;

    if (hasMorph) {
      return (
        <div className="flex flex-wrap gap-x-1.5 gap-y-1" style={{ direction: "ltr" }}>
          {v.morphology.map((m: any, idx: number) => {
            const isHovered =
              hoveredWord?.word === m.word ||
              (hoveredEnglishWord?.matchedOriginal === m.word && hoveredEnglishWord?.verseId === v.id);
            return (
              <span
                key={idx}
                onMouseEnter={(e) =>
                  handleOriginalWordMouseEnter(e, m.word, m.lemma, m.pos, m.parse)
                }
                onMouseLeave={handleOriginalWordMouseLeave}
                onClick={() => {
                  handleVerseClick(v.id);
                  handleOriginalWordClick(m.word, m.lemma);
                }}
                className="inline-block rounded px-0.5 transition-all duration-150 cursor-pointer font-serif select-none"
                style={{
                  color: isHovered ? "var(--primary)" : "var(--text-primary)",
                  background: isHovered ? "rgba(37, 99, 235, 0.08)" : "transparent",
                  boxShadow: isHovered ? "0 0 0 1px var(--primary)" : "none",
                  fontSize: `${textSize * 1.1}px`,
                }}
              >
                {m.word}
              </span>
            );
          })}
        </div>
      );
    } else {
      // Split Hebrew words
      const words = (v.text_original || "").split(/\s+/);
      const isOT = BIBLE_BOOKS.find((b) => b.code === v.book)?.testament === "OT";
      return (
        <div
          className="flex flex-wrap gap-x-1.5 gap-y-1 font-serif leading-loose"
          style={{ direction: isOT ? "rtl" : "ltr" }}
        >
          {words.map((w, idx) => {
            const cleanWord = w.replace(/[.,;:!?׃.-]/g, "").trim();
            const isHovered =
              hoveredWord?.word === cleanWord ||
              (hoveredEnglishWord?.matchedOriginal === cleanWord && hoveredEnglishWord?.verseId === v.id);
            return (
              <span
                key={idx}
                onMouseEnter={(e) => handleOriginalWordMouseEnter(e, cleanWord)}
                onMouseLeave={handleOriginalWordMouseLeave}
                onClick={() => {
                  handleVerseClick(v.id);
                  handleOriginalWordClick(cleanWord);
                }}
                className="inline-block rounded px-0.5 transition-all duration-150 cursor-pointer select-none"
                style={{
                  color: isHovered ? "var(--primary)" : "var(--text-primary)",
                  background: isHovered ? "rgba(37, 99, 235, 0.08)" : "transparent",
                  boxShadow: isHovered ? "0 0 0 1px var(--primary)" : "none",
                  fontSize: `${textSize * 1.15}px`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      );
    }
  };

  // Render English text with hover mapping
  const renderEnglishTextWithHover = (v: Verse) => {
    const isOT = BIBLE_BOOKS.find((b) => b.code === v.book)?.testament === "OT";
    const wordsWithPunct = v.text_en.split(/(\s+)/);

    return (
      <span className="leading-relaxed" style={{ fontSize: `${textSize}px`, color: "var(--text-primary)" }}>
        {wordsWithPunct.map((part, idx) => {
          const isSpacing = /^\s+$/.test(part);
          if (isSpacing) return part;

          const cleanWord = part.replace(/[.,;:!?(){}[\]"']/g, "").trim();
          if (!cleanWord) return part;

          const isHighlightedByOriginal = hoveredWord?.lemma && isWordMatch(cleanWord, hoveredWord.lemma, isOT);
          const isHovered = hoveredEnglishWord?.word === cleanWord && hoveredEnglishWord?.verseId === v.id;

          return (
            <span
              key={idx}
              onMouseEnter={() => {
                let matchedWord: string | null = null;
                if (v.morphology && v.morphology.length > 0) {
                  for (const m of v.morphology) {
                    if (isWordMatch(cleanWord, m.lemma || m.word, isOT)) {
                      matchedWord = m.word;
                      break;
                    }
                  }
                } else {
                  // Fallback split match for Hebrew if no morph
                  const origWords = (v.text_original || "").split(/\s+/);
                  for (const w of origWords) {
                    const cleanOrig = w.replace(/[.,;:!?׃.-]/g, "").trim();
                    if (isWordMatch(cleanWord, cleanOrig, isOT)) {
                      matchedWord = cleanOrig;
                      break;
                    }
                  }
                }
                setHoveredEnglishWord({
                  word: cleanWord,
                  verseId: v.id,
                  matchedOriginal: matchedWord,
                });
              }}
              onMouseLeave={() => setHoveredEnglishWord(null)}
              className="transition-all duration-150 rounded px-0.5 cursor-help"
              style={{
                background: (isHovered || isHighlightedByOriginal) ? "rgba(37, 99, 235, 0.1)" : "transparent",
                color: (isHovered || isHighlightedByOriginal) ? "var(--primary)" : "inherit",
                boxShadow: (isHovered || isHighlightedByOriginal) ? "0 0 0 1px rgba(37, 99, 235, 0.25)" : "none",
              }}
            >
              {part}
            </span>
          );
        })}
      </span>
    );
  };

  // Verse Number Click Actions
  const handleVerseNumberClick = (e: React.MouseEvent, v: Verse) => {
    e.stopPropagation();
    setVerseMenu({
      verseId: v.id,
      verseText: v.text_en,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
    setVerseMenu(null);
  };

  const handleMenuCommentary = (verseId: string) => {
    handleVerseClick(verseId);
    setVerseMenu(null);
  };

  const handleMenuMap = (verseId: string) => {
    handleVerseClick(verseId).then(() => {
      if (props.onViewChange) props.onViewChange("map");
    });
    setVerseMenu(null);
  };

  const isFirstChapter = book === "GEN" && chapter === 1;
  const isLastChapter = book === "REV" && chapter === 22;

  return (
    <div className="flex flex-col h-full overflow-hidden relative bg-slate-50">
      <div
        className="h-16 flex items-center justify-between px-5 border-b border-slate-200 bg-white shrink-0 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => !isFirstChapter && navigateChapter(-1)}
            disabled={isFirstChapter}
            className={`p-1.5 rounded-md transition-colors ${
              isFirstChapter ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100 cursor-pointer"
            }`}
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronLeft size={18} />
          </button>
 
          {/* Book Selector */}
          <div>
            <button
              onClick={() => setShowBookPicker(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
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
          </div>
 
          <button
            onClick={() => !isLastChapter && navigateChapter(1)}
            disabled={isLastChapter}
            className={`p-1.5 rounded-md transition-colors ${
              isLastChapter ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100 cursor-pointer"
            }`}
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronRight size={18} />
          </button>

          {/* Vertical Divider */}
          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Quick Create Session button */}
          <button
            onClick={async () => {
              try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
                const res = await fetch(`${apiBase}/api/sessions/create`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: "New Reading Session", content: "" })
                }).then(r => r.json());
                
                if (res.session_id) {
                  window.dispatchEvent(new CustomEvent("rhema-session-updated"));
                  if (props.onViewChange) props.onViewChange("sessions");
                }
              } catch (err) {
                console.error(err);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer transition-all font-sans shadow-sm"
            title="Create new study session"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            <Plus size={15} className="text-blue-600" />
            <span>+ Session</span>
          </button>

          {/* Languages Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-800 cursor-pointer transition-colors shadow-sm font-sans"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              <span>Languages</span>
              <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${showLangDropdown ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showLangDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute left-0 mt-3 min-w-[220px] rounded-xl border border-slate-200 bg-white shadow-xl p-2 z-50 flex flex-col gap-1"
                  >
                    {enabledTranslations.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => toggleTranslation(t.key)}
                        className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors text-left font-sans"
                      >
                        <span
                          className={`text-base transition-colors ${
                            t.enabled ? "text-[var(--primary)] font-semibold" : "text-slate-700"
                          }`}
                        >
                          {t.label}
                        </span>
                        {t.enabled && (
                          <Check size={18} className="text-[var(--primary)] shrink-0" strokeWidth={2.5} />
                        )}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
 
        {/* Text Sizer */}
        <div className="flex items-center gap-4 mr-4">
          {/* Font Sizer */}
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            <button
              onClick={() => setTextSize(Math.max(12, textSize - 1))}
              className="px-2.5 py-1 hover:bg-slate-100 transition-colors border-r border-slate-200 cursor-pointer text-xs font-semibold text-slate-500 font-sans"
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="px-2 py-1 text-[10px] font-mono text-slate-400 select-none">
              {textSize}px
            </span>
            <button
              onClick={() => setTextSize(Math.min(26, textSize + 1))}
              className="px-2.5 py-1 hover:bg-slate-100 transition-colors border-l border-slate-200 cursor-pointer text-xs font-semibold text-slate-500 font-sans"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Reading Content */}
      <div className="flex flex-1 overflow-hidden bg-slate-50">
        {/* Main Verses Panel */}
        <div className="flex-1 overflow-y-auto p-8 bg-white border border-slate-200 rounded-2xl shadow-sm m-4 relative" onClick={() => setVerseMenu(null)}>
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

              {verses.map((v) => {
                const isSelected = selectedVerse?.verse?.id === v.id;
                return (
                  <motion.div
                    key={v.id}
                    layout
                    draggable
                    onDragStart={(e) => handleDragStart(e as any, v.id, v.text_en)}
                    onDragEnd={handleDragEnd}
                    className="group rounded-lg p-3 transition-all duration-150 cursor-grab active:cursor-grabbing"
                    style={{
                      background: isSelected ? "rgba(52, 211, 153, 0.05)" : "transparent",
                    }}
                    whileHover={{
                      backgroundColor: "rgba(52, 211, 153, 0.02)",
                    }}
                    onClick={() => handleVerseClick(v.id)}
                  >
                    <div
                      className="grid gap-5 divide-x divide-slate-200"
                      style={{
                        gridTemplateColumns: activeTranslations.length > 1 ? `repeat(${activeTranslations.length}, 1fr)` : "1fr",
                      }}
                    >
                      {activeTranslations.map((t, idx) => (
                        <div key={t.key} className={`flex items-start justify-between group/col ${idx > 0 ? "pl-5" : ""} ${speakingKey === `${v.id}-${t.key}` ? "ring-2 ring-blue-500/20 rounded-lg bg-blue-50/10 p-1 -m-1" : ""}`}>
                          <div className="flex items-start">
                            <button
                              onClick={(e) => handleVerseNumberClick(e, v)}
                              className="text-xs font-bold mr-2.5 mt-0.5 select-none hover:text-blue-600 cursor-context-menu shrink-0"
                              style={{ color: "var(--primary)" }}
                            >
                              {v.verse}
                            </button>
                            {t.key === "text_original" ? (
                              renderOriginalText(v)
                            ) : t.key === "text_en" ? (
                              renderEnglishTextWithHover(v)
                            ) : (
                              <span
                                className="leading-relaxed"
                                style={{ fontSize: `${textSize}px`, color: "var(--text-primary)" }}
                              >
                                {(v as any)[t.key] || "—"}
                              </span>
                            )}
                          </div>
                          {t.key !== "text_original" && ((v as any)[t.key] || t.key === "text_en") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const text = t.key === "text_en" ? v.text_en : (v as any)[t.key];
                                const langCode = t.key.replace("text_", "");
                                handleSpeakText(text, langCode, `${v.id}-${t.key}`);
                              }}
                              className={`ml-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0 opacity-50 group-hover/col:opacity-100 ${
                                speakingKey === `${v.id}-${t.key}` ? "text-blue-600 bg-blue-50 opacity-100!" : "text-slate-400 hover:text-slate-700"
                              }`}
                              title="Listen to translation"
                            >
                              <Volume2 size={13} className={speakingKey === `${v.id}-${t.key}` ? "animate-pulse" : ""} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Verse Metadata Badges */}
                    <div className="flex items-center gap-3 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {v.cross_references_count > 0 && (
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold" style={{ color: "var(--secondary)" }}>
                          <Link2 size={10} /> {v.cross_references_count} cross-references
                        </span>
                      )}
                      {v.places_count > 0 && (
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold" style={{ color: "var(--accent)" }}>
                          <MapPin size={10} /> {v.places_count} places geocoded
                        </span>
                      )}
                      {v.commentaries.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>
                          <MessageSquareText size={10} /> Commentary available
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabbed Side Exegesis Drawer */}
        <AnimatePresence>
          {selectedVerse && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="w-[450px] border border-slate-200 overflow-hidden flex flex-col shrink-0 bg-white shadow-md my-4 mr-4 rounded-2xl animate-none"
            >
              <div className="flex border-b border-slate-200 text-sm font-semibold bg-slate-50 justify-between items-center shrink-0 pr-4">
                <span className="pl-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">Exegesis Study</span>
                <button
                  onClick={() => {
                    setSelectedVerse(null);
                    setStudyInitialWord(null);
                    setStudyInitialTab("verse");
                  }}
                  className="p-2 hover:text-red-500 transition-colors cursor-pointer rounded-full hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <StudyPane
                  verseId={selectedVerse.verse.id}
                  initialTab={studyInitialTab}
                  initialLexiconWord={studyInitialWord}
                  onVerseClick={(id) => {
                    const parts = id.split(".");
                    if (parts.length >= 2) {
                      setBook(parts[0]);
                      setChapter(parseInt(parts[1]));
                    }
                    if (props.setSelectedVerseId) {
                      props.setSelectedVerseId(id);
                    }
                    handleVerseClick(id);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Word Hover Tooltip */}
      <AnimatePresence>
        {hoveredWord && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 p-4 rounded-xl border border-slate-200 bg-white max-w-xs text-xs pointer-events-none shadow-md"
            style={{
              top: hoveredWord.y + 25,
              left: hoveredWord.x - 20,
            }}
          >
            <div className="font-bold text-sm mb-1 text-slate-800 flex items-center justify-between gap-2">
              <span>{hoveredWord.word}</span>
              {getTransliteration(hoveredWord.word) && (
                <span className="text-[10px] text-sky-600 font-mono italic">
                  [{getTransliteration(hoveredWord.word)}]
                </span>
              )}
            </div>
            {hoveredWord.lemma && (
              <div className="mb-0.5">
                <span className="text-slate-500">Lemma: </span>
                <span className="font-semibold text-slate-700">{hoveredWord.lemma}</span>
                {getTransliteration(hoveredWord.lemma) && (
                  <span className="ml-1 text-sky-600 font-mono text-[10px] italic">
                    ({getTransliteration(hoveredWord.lemma)})
                  </span>
                )}
              </div>
            )}
            {hoveredWord.pos && (
              <div className="mb-0.5">
                <span className="text-slate-500">Part of Speech: </span>
                <span className="font-mono text-emerald-600">{hoveredWord.pos}</span>
              </div>
            )}
            {hoveredWord.parse && (
              <div className="mb-1">
                <span className="text-slate-500">Parsing: </span>
                <span className="font-mono text-sky-600">{hoveredWord.parse}</span>
              </div>
            )}
            {hoveredWord.strongsId && (
              <div className="mb-1">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold font-mono bg-purple-100 text-purple-700">
                  {hoveredWord.strongsId}
                </span>
              </div>
            )}
            {hoveredWord.definition ? (
              <div className="mt-2 pt-2 border-t text-slate-700 leading-relaxed italic border-slate-150 p-2.5 bg-slate-50 rounded-lg">
                {hoveredWord.definition.length > 90
                  ? hoveredWord.definition.substring(0, 90) + "..."
                  : hoveredWord.definition}
              </div>
            ) : (
              <div className="mt-2 pt-2 border-t text-[10px] text-slate-400 italic border-slate-150 p-2 text-center">
                Loading lexicon definition...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Verse Number Action Menu */}
      <AnimatePresence>
        {verseMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setVerseMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className="fixed z-50 rounded-xl border p-1.5 w-52 shadow-2xl flex flex-col"
              style={{
                top: verseMenu.y + 12,
                left: verseMenu.x,
                background: "var(--bg-popover)",
                borderColor: "var(--border-subtle)",
                backdropFilter: "var(--glass-blur)",
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
              }}
            >
              <button
                onClick={() => copyToClipboard(`[${verseMenu.verseId}] ${verseMenu.verseText}`)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <Copy size={12} />
                Copy Verse Reference
              </button>
              <button
                onClick={() => handleMenuCommentary(verseMenu.verseId)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <MessageSquareText size={12} />
                View Commentary
              </button>
              <button
                onClick={() => handleMenuMap(verseMenu.verseId)}
                className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <MapPin size={12} />
                Map Geography Places
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Copy Toast */}
      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs shadow-lg z-50 font-medium"
            style={{ background: "var(--primary)", color: "var(--bg-base)" }}
          >
            Verse copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>

      <BookChapterPickerModal
        isOpen={showBookPicker}
        onClose={() => setShowBookPicker(false)}
        selectedBook={book}
        selectedChapter={chapter}
        onSelect={(b, c) => {
          setBook(b);
          setChapter(c);
        }}
      />

      {/* Lexicon Detail Modal */}
      <AnimatePresence>
        {selectedLexiconModalWord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setSelectedLexiconModalWord(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden z-10 p-6"
            >
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
                <div className="flex flex-col gap-1">
                  <h3 className="text-3xl font-bold font-serif text-slate-900">{selectedLexiconModalWord.lemma}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {selectedLexiconModalWord.strongs_id}
                    </span>
                    {getTransliteration(selectedLexiconModalWord.lemma) && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium font-sans">
                        <span>Pronunciation: <span className="italic font-semibold">{getTransliteration(selectedLexiconModalWord.lemma)}</span></span>
                        <button
                          onClick={() => handlePlayAudio(selectedLexiconModalWord.lemma)}
                          className="p-0.5 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                          title="Play Pronunciation Audio"
                        >
                          <Volume2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLexiconModalWord(null)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-450 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase font-sans">Original Transliterated Term</span>
                      <span className="font-bold text-slate-800 text-sm">{selectedLexiconModalWord.lemma}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase font-sans">Strong&apos;s Catalog ID</span>
                      <span className="font-bold text-slate-800 text-sm font-mono">{selectedLexiconModalWord.strongs_id}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans">Lexicon Definition</h4>
                  <p className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-200 font-serif">
                    {selectedLexiconModalWord.definition}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
