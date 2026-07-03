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
} from "lucide-react";
import { fetchChapter, fetchVerseDetails, lookupLexicon, fetchOccurrences } from "@/lib/api";
import { BIBLE_BOOKS, getBookName } from "@/lib/books";
import BookChapterPickerModal from "./BookChapterPickerModal";

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
  const [activeTab, setActiveTab] = useState<"verse" | "lexicon">("verse");

  // Lexicon States
  const [lexiconData, setLexiconData] = useState<any[]>([]);
  const [lexiconLoading, setLexiconLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);
  const [activeLexiconWord, setActiveLexiconWord] = useState<string | null>(null);
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
        setSelectedVerse(null);
        setActiveLexiconWord(null);
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
      setActiveTab("verse");
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  };

  const navigateChapter = (direction: number) => {
    const newChapter = chapter + direction;
    if (newChapter < 1) {
      const bookIdx = BIBLE_BOOKS.findIndex((b) => b.code === book);
      if (bookIdx > 0) {
        setBook(BIBLE_BOOKS[bookIdx - 1].code);
        setChapter(150); // Will clamp naturally in backend
      }
    } else {
      setChapter(newChapter);
    }
  };

  const toggleTranslation = (key: string) => {
    setEnabledTranslations((prev) =>
      prev.map((t) => (t.key === key ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const activeTranslations = enabledTranslations.filter((t) => t.enabled);

  // Audio synthesis helper
  const speakWord = (word: string, isGreek: boolean) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = isGreek ? "el-GR" : "he-IL";
      window.speechSynthesis.speak(utterance);
    }
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
    setActiveLexiconWord(query);
    setActiveTab("lexicon");
    setLexiconLoading(true);
    setOccurrencesLoading(true);

    try {
      const data = await lookupLexicon(query);
      const results = data.results || [];
      setLexiconData(results);
      if (results.length > 0) {
        setSelectedLexiconModalWord(results[0]);
      }

      const occData = await fetchOccurrences(query);
      setOccurrences(occData.occurrences || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLexiconLoading(false);
      setOccurrencesLoading(false);
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
                onClick={() => handleOriginalWordClick(m.word, m.lemma)}
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
                onClick={() => handleOriginalWordClick(cleanWord)}
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

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div
        className="h-16 flex items-center justify-between px-5 border-b shrink-0"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateChapter(-1)}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
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
            onClick={() => navigateChapter(1)}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Text Sizer & Translation Toggles */}
        <div className="flex items-center gap-4">
          {/* Font Sizer */}
          <div className="flex items-center border rounded-xl overflow-hidden bg-slate-50/50" style={{ borderColor: "var(--border-subtle)" }}>
            <button
              onClick={() => setTextSize(Math.max(12, textSize - 1))}
              className="px-2.5 py-1 hover:bg-slate-100 transition-colors border-r cursor-pointer text-xs font-semibold text-slate-500"
              style={{ borderColor: "var(--border-subtle)" }}
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="px-2 py-1 text-[10px] font-mono text-slate-400 select-none">
              {textSize}px
            </span>
            <button
              onClick={() => setTextSize(Math.min(26, textSize + 1))}
              className="px-2.5 py-1 hover:bg-slate-100 transition-colors border-l cursor-pointer text-xs font-semibold text-slate-500"
              style={{ borderColor: "var(--border-subtle)" }}
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-5 bg-slate-200" />

          {/* Translation Pill Buttons */}
          <div className="flex items-center gap-2.5">
            {enabledTranslations.map((t) => (
              <button
                key={t.key}
                onClick={() => toggleTranslation(t.key)}
                className="px-4 py-1.5 rounded-2xl text-[13px] transition-all duration-200 cursor-pointer font-medium border shadow-xs"
                style={{
                  background: t.enabled ? "rgba(37, 99, 235, 0.08)" : "var(--bg-surface-elevated)",
                  color: t.enabled ? "var(--primary)" : "var(--text-muted)",
                  borderColor: t.enabled ? "rgba(37, 99, 235, 0.25)" : "var(--border-subtle)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reading Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Verses Panel */}
        <div className="flex-1 overflow-y-auto p-6" onClick={() => setVerseMenu(null)}>
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
                    className="group rounded-lg p-3 transition-all duration-150"
                    style={{
                      background: isSelected ? "rgba(52, 211, 153, 0.05)" : "transparent",
                    }}
                    whileHover={{
                      backgroundColor: "rgba(52, 211, 153, 0.02)",
                    }}
                    onClick={() => handleVerseClick(v.id)}
                  >
                    <div
                      className={`grid gap-5`}
                      style={{
                        gridTemplateColumns: activeTranslations.length > 1 ? `repeat(${activeTranslations.length}, 1fr)` : "1fr",
                      }}
                    >
                      {activeTranslations.map((t) => (
                        <div key={t.key} className="flex items-start">
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
              className="w-96 border-l overflow-hidden flex flex-col shrink-0"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
              }}
            >
              {/* Drawer Tab Headers */}
              <div className="flex border-b text-xs font-semibold" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-elevated)" }}>
                <button
                  onClick={() => setActiveTab("verse")}
                  className="flex-1 py-3 text-center transition-colors cursor-pointer border-b-2"
                  style={{
                    color: activeTab === "verse" ? "var(--primary)" : "var(--text-muted)",
                    borderColor: activeTab === "verse" ? "var(--primary)" : "transparent",
                  }}
                >
                  VERSE STUDY
                </button>
                {activeLexiconWord && (
                  <button
                    onClick={() => setActiveTab("lexicon")}
                    className="flex-1 py-3 text-center transition-colors cursor-pointer border-b-2"
                    style={{
                      color: activeTab === "lexicon" ? "var(--accent)" : "var(--text-muted)",
                      borderColor: activeTab === "lexicon" ? "var(--accent)" : "transparent",
                    }}
                  >
                    LEXICON: {activeLexiconWord}
                  </button>
                )}
                <button
                  onClick={() => setSelectedVerse(null)}
                  className="px-3 hover:text-red-400 transition-colors border-l"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {activeTab === "verse" && (
                  <>
                    <h3 className="text-base font-bold mb-4" style={{ color: "var(--primary)" }}>
                      {selectedVerse.verse.id} Study Pane
                    </h3>

                    {/* Commentary */}
                    {selectedVerse.commentaries.length > 0 ? (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                          Matthew Henry Commentary
                        </h4>
                        {selectedVerse.commentaries.map((c, i) => (
                          <div
                            key={i}
                            className="text-xs leading-relaxed p-3.5 rounded-xl mb-2.5 border"
                            style={{
                              background: "var(--bg-surface-elevated)",
                              borderColor: "var(--border-subtle)",
                              color: "var(--text-primary)",
                            }}
                          >
                            {c.text}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs italic p-4 text-center text-slate-500">
                        No commentaries available for this verse.
                      </div>
                    )}

                    {/* Cross References */}
                    {selectedVerse.cross_references.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--secondary)" }}>
                          Theological Cross References
                        </h4>
                        <div className="space-y-2">
                          {selectedVerse.cross_references.map((cr) => (
                            <div
                              key={cr.to_verse}
                              className="p-3 rounded-xl border flex flex-col gap-1.5 text-xs"
                              style={{ background: "var(--bg-surface-elevated)", borderColor: "var(--border-subtle)" }}
                            >
                              <div className="flex items-center justify-between w-full">
                                <button
                                  onClick={() => handleVerseClick(cr.to_verse)}
                                  className="font-bold text-blue-600 hover:underline cursor-pointer text-left"
                                >
                                  {cr.to_verse}
                                </button>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                  {cr.votes} votes
                                </span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-slate-600 italic">
                                &ldquo;{cr.text_en || "Verse text not available"}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Places */}
                    {selectedVerse.places.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
                          Geocoded Locations
                        </h4>
                        <div className="space-y-2">
                          {selectedVerse.places.map((p, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 p-2.5 rounded-lg text-xs border"
                              style={{ background: "var(--bg-surface-elevated)", borderColor: "var(--border-subtle)" }}
                            >
                              <MapPin size={12} className="text-purple-400" />
                              <div>
                                <span className="font-semibold text-slate-200">{p.name}</span>
                                <span className="text-[10px] block text-slate-500">{p.type}</span>
                              </div>
                              <span className="ml-auto font-mono text-[10px] text-slate-400">
                                {p.latitude.toFixed(2)}, {p.longitude.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Timeline Events */}
                    {selectedVerse.events.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--primary)" }}>
                          Chronological Events
                        </h4>
                        {selectedVerse.events.map((e, i) => (
                          <div
                            key={i}
                            className="p-3.5 rounded-xl mb-2.5 border bg-white shadow-sm"
                            style={{ borderColor: "var(--border-subtle)" }}
                          >
                            <div className="text-xs font-bold text-slate-800">{e.title}</div>
                            <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                              Year {e.year < 0 ? `${Math.abs(e.year)} BC` : `AD ${e.year}`} • {e.location}
                            </div>
                            {e.description && (
                              <p className="text-[10px] leading-relaxed text-slate-500 mt-1">{e.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "lexicon" && activeLexiconWord && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold" style={{ color: "var(--accent)" }}>
                        Strong&apos;s Definitions
                      </h3>
                      <button
                        onClick={() => speakWord(activeLexiconWord, BIBLE_BOOKS.find((b) => b.code === book)?.testament === "NT")}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-450 hover:text-blue-600 transition-all cursor-pointer"
                        title="Speak pronunciation"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>

                    {lexiconLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
                      </div>
                    ) : lexiconData.length > 0 ? (
                      <div className="space-y-5">
                        {lexiconData.map((item, idx) => (
                          <div key={idx} className="border-b pb-4 last:border-b-0" style={{ borderColor: "var(--border-subtle)" }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(167, 139, 250, 0.15)", color: "var(--accent)" }}>
                                {item.strongs_id}
                              </span>
                              <span className="text-sm font-semibold text-slate-800">{item.lemma}</span>
                              {getTransliteration(item.lemma) && (
                                <span className="text-xs text-sky-600 font-mono italic">
                                  (Pronunciation: {getTransliteration(item.lemma)})
                                </span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed text-slate-600 whitespace-pre-line p-3 rounded-lg border"
                               style={{ background: "rgba(15, 23, 42, 0.02)", borderColor: "var(--border-subtle)" }}>
                              {item.definition}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs italic text-center py-6 text-slate-500">
                        No Strong&apos;s definitions found for &quot;{activeLexiconWord}&quot;.
                      </div>
                    )}

                    {/* Occurrences List */}
                    <div className="mt-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5 text-slate-400">
                        Occurrences in Scripture
                      </h4>
                      {occurrencesLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 size={18} className="animate-spin text-slate-500" />
                        </div>
                      ) : occurrences.length > 0 ? (
                        <div className="space-y-1.5">
                          {occurrences.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => {
                                const parts = o.id.split(".");
                                setBook(parts[0]);
                                setChapter(parseInt(parts[1]));
                                handleVerseClick(o.id);
                              }}
                              className="text-left text-xs p-2.5 rounded-lg hover:bg-slate-50 block w-full truncate border border-slate-200 hover:border-blue-200 transition-all cursor-pointer bg-white shadow-sm"
                            >
                              <span className="font-semibold text-blue-600 mr-2">
                                {getBookName(o.book)} {o.chapter}:{o.verse}
                              </span>
                              <span className="text-slate-600 text-[11px]">{o.text_en}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs italic text-center py-4 text-slate-500">
                          No other occurrences found.
                        </div>
                      )}
                    </div>
                  </>
                )}
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
            className="fixed z-50 p-3 rounded-lg border max-w-xs text-xs pointer-events-none"
            style={{
              top: hoveredWord.y + 25,
              left: hoveredWord.x - 20,
              background: "var(--bg-popover)",
              borderColor: "var(--border-subtle)",
              backdropFilter: "var(--glass-blur)",
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
              color: "var(--text-primary)",
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
                <span className="text-[10px] px-1 py-0.2 rounded font-bold" style={{ background: "rgba(167, 139, 250, 0.15)", color: "var(--accent)" }}>
                  {hoveredWord.strongsId}
                </span>
              </div>
            )}
            {hoveredWord.definition ? (
              <div className="mt-1 pt-1.5 border-t italic leading-relaxed text-slate-600 border-slate-200">
                {hoveredWord.definition.length > 90
                  ? hoveredWord.definition.substring(0, 90) + "..."
                  : hoveredWord.definition}
              </div>
            ) : (
              <div className="mt-1 pt-1.5 border-t text-[10px] text-slate-400 italic border-slate-200">
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
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setSelectedLexiconModalWord(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden z-10 p-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl" style={{ background: "rgba(167, 139, 250, 0.15)", color: "var(--accent)" }}>
                    {selectedLexiconModalWord.strongs_id}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-800">{selectedLexiconModalWord.lemma}</h3>
                    {getTransliteration(selectedLexiconModalWord.lemma) && (
                      <span className="text-xs text-sky-600 font-mono italic">
                        Pronunciation: {getTransliteration(selectedLexiconModalWord.lemma)}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedLexiconModalWord(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="p-4 rounded-2xl bg-blue-50/30 border border-blue-100/50 space-y-2 text-xs text-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Dictionary Term</span>
                      <span className="font-bold text-slate-800 text-sm">{selectedLexiconModalWord.lemma}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Strong&apos;s Code</span>
                      <span className="font-bold text-slate-800 text-sm">{selectedLexiconModalWord.strongs_id}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Lexicon Definition</h4>
                  <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-serif">
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
