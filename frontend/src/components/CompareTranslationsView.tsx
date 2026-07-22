"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Volume2,
  WifiOff,
} from "lucide-react";
import BookChapterPickerModal from "@/components/BookChapterPickerModal";
import { BIBLE_BOOKS, getBookName } from "@/lib/books";
import { setGlassDragImage } from "@/lib/drag";
import { invokeSpeech } from "@/lib/speech";
import {
  DEFAULT_COMPARE_PREFERENCES,
  DEFAULT_COMPARE_TRANSLATION_IDS,
  addCompareTranslation,
  moveCompareTranslation,
  readComparePreferences,
  removeCompareTranslation,
  replaceCompareTranslation,
  writeComparePreferences,
  type ComparePreferences,
} from "@/lib/translations/compareState";
import { TranslationError, type TranslationDescriptor, type TranslationPassage } from "@/lib/translations/domain";
import { getTranslationService } from "@/lib/translations/runtime";

interface CompareTranslationsViewProps {
  book: string;
  chapter: number;
  setBook: (book: string) => void;
  setChapter: (chapter: number) => void;
  setSelectedVerseId: (verseId: string | null) => void;
  onViewChange: (view: string) => void;
}

type ColumnState =
  | { status: "loading" }
  | { status: "ready"; passage: TranslationPassage }
  | { status: "error"; error: TranslationError };

function asTranslationError(error: unknown): TranslationError {
  if (error instanceof TranslationError) return error;
  return new TranslationError(
    "temporary_error",
    error instanceof Error ? error.message : "The passage could not be loaded.",
    true,
  );
}

function errorLabel(error: TranslationError): string {
  switch (error.code) {
    case "login_required": return "Sign in required";
    case "entitlement_required": return "Translation entitlement required";
    case "subscription_required": return "Subscription required";
    case "license_expired": return "Translation licence expired";
    case "remote_quota_exhausted": return "Remote translation quota exhausted";
    case "rate_limited": return "Translation service rate limited";
    case "unavailable_offline": return "Unavailable while offline";
    case "missing_passage": return "Passage unavailable";
    case "remote_disabled": return "Remote translations are disabled in this build";
    default: return error.message || "The passage could not be loaded";
  }
}

function availabilityLabel(descriptor: TranslationDescriptor, passage?: TranslationPassage): string {
  if (passage?.cacheState === "device_stale") return "Cached, refresh pending";
  if (passage?.cacheState === "device_fresh") return "Cached on device";
  if (passage?.cacheState === "live_remote") return "Live from Rhelo API";
  if (descriptor.source === "embedded") return "Embedded offline";
  if (descriptor.source === "installed_pack") return "Installed pack";
  return descriptor.availability === "cached_remote" ? "Cached remote" : "Online";
}

export default function CompareTranslationsView(props: CompareTranslationsViewProps) {
  const serviceRef = useRef(getTranslationService());
  const scrollContainersRef = useRef(new Map<string, HTMLDivElement>());
  const scrollSyncLockRef = useRef(false);
  const [catalogue, setCatalogue] = useState<TranslationDescriptor[]>([]);
  const [preferences, setPreferences] = useState<ComparePreferences>(DEFAULT_COMPARE_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [columnStates, setColumnStates] = useState<Record<string, ColumnState>>({});
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void serviceRef.current.listTranslations().then((translations) => {
      if (!active) return;
      setCatalogue(translations);
      setPreferences(readComparePreferences(translations.map((translation) => translation.id)));
      setPreferencesReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (preferencesReady) writeComparePreferences(preferences);
  }, [preferences, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady || preferences.translationIds.length === 0) return;
    const controller = new AbortController();
    const requestedIds = [...preferences.translationIds];
    setColumnStates((current) => {
      const loading: Record<string, ColumnState> = {};
      for (const id of requestedIds) {
        const state = current[id];
        loading[id] = state?.status === "ready"
          && state.passage.reference.bookId === props.book
          && state.passage.reference.chapter === props.chapter
          ? state
          : { status: "loading" };
      }
      return loading;
    });

    for (const translationId of requestedIds) {
      void serviceRef.current.getPassage({
        translationId,
        reference: { bookId: props.book, chapter: props.chapter },
        signal: controller.signal,
      }).then((passage) => {
        if (controller.signal.aborted) return;
        setColumnStates((current) => ({ ...current, [translationId]: { status: "ready", passage } }));
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setColumnStates((current) => ({ ...current, [translationId]: { status: "error", error: asTranslationError(error) } }));
      });
    }

    return () => controller.abort();
  }, [preferences.translationIds, preferencesReady, props.book, props.chapter]);

  const retryColumn = async (translationId: string) => {
    setColumnStates((current) => ({ ...current, [translationId]: { status: "loading" } }));
    try {
      const passage = await serviceRef.current.getPassage({
        translationId,
        reference: { bookId: props.book, chapter: props.chapter },
      });
      setColumnStates((current) => ({ ...current, [translationId]: { status: "ready", passage } }));
    } catch (error) {
      setColumnStates((current) => ({ ...current, [translationId]: { status: "error", error: asTranslationError(error) } }));
    }
  };

  const updateTranslations = (translationIds: string[]) => {
    setPreferences((current) => ({ ...current, translationIds }));
  };

  const navigateChapter = (direction: -1 | 1) => {
    const bookIndex = BIBLE_BOOKS.findIndex((book) => book.code === props.book);
    const currentBook = BIBLE_BOOKS[bookIndex];
    if (!currentBook) return;
    props.setSelectedVerseId(null);
    if (direction === -1 && props.chapter > 1) return props.setChapter(props.chapter - 1);
    if (direction === 1 && props.chapter < currentBook.chapters) return props.setChapter(props.chapter + 1);
    const nextBook = BIBLE_BOOKS[bookIndex + direction];
    if (!nextBook) return;
    props.setBook(nextBook.code);
    props.setChapter(direction === -1 ? nextBook.chapters : 1);
  };

  const handleColumnScroll = (translationId: string, source: HTMLDivElement) => {
    if (!preferences.synchronizedScroll || scrollSyncLockRef.current) return;
    const verseRows = [...source.querySelectorAll<HTMLElement>("[data-compare-verse]")];
    const sourceTop = source.scrollTop;
    const anchor = verseRows.reduce((nearest, row) => row.offsetTop <= sourceTop + 32 ? row : nearest, verseRows[0]);
    const verseNumber = anchor?.dataset.compareVerse;
    if (!anchor || !verseNumber) return;
    const anchorOffset = anchor.offsetTop - sourceTop;

    scrollSyncLockRef.current = true;
    for (const [id, target] of scrollContainersRef.current) {
      if (id === translationId) continue;
      const targetAnchor = target.querySelector<HTMLElement>(`[data-compare-verse="${verseNumber}"]`);
      if (targetAnchor) target.scrollTop = Math.max(0, targetAnchor.offsetTop - anchorOffset);
    }
    requestAnimationFrame(() => { scrollSyncLockRef.current = false; });
  };

  const handleCopy = async (descriptor: TranslationDescriptor, verse: number, text: string) => {
    const reference = `${props.book} ${props.chapter}:${verse}`;
    await navigator.clipboard.writeText(`[${reference} | ${descriptor.abbreviation} | ${descriptor.id}] ${text}`);
    setActionMessage(`${reference} copied with translation metadata.`);
    window.setTimeout(() => setActionMessage(null), 1800);
  };

  const handleSpeak = async (descriptor: TranslationDescriptor, verse: number, text: string) => {
    const key = `${descriptor.id}:${verse}`;
    setSpeakingKey(key);
    try {
      await invokeSpeech("speak_text", { text, lang: descriptor.languageCode });
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Text-to-speech failed.");
    } finally {
      setSpeakingKey(null);
    }
  };

  const handleOpenInRead = (verse: number) => {
    props.setSelectedVerseId(`${props.book}.${props.chapter}.${verse}`);
    props.onViewChange("read");
  };

  const unselectedTranslations = catalogue.filter((descriptor) => !preferences.translationIds.includes(descriptor.id));

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-slate-50">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900">Compare Translations</h1>
            <p className="text-xs text-slate-500">One reference, independent translation columns</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => navigateChapter(-1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Previous chapter">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => setShowBookPicker(true)} className="flex min-w-44 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:border-blue-300">
            <span>{getBookName(props.book)} {props.chapter}</span>
            <ChevronDown size={15} className="text-slate-400" />
          </button>
          <button type="button" onClick={() => navigateChapter(1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Next chapter">
            <ChevronRight size={18} />
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={preferences.synchronizedScroll}
              onChange={(event) => setPreferences((current) => ({ ...current, synchronizedScroll: event.target.checked }))}
              className="h-4 w-4 accent-blue-600"
            />
            Sync by verse
          </label>
          <select
            value=""
            disabled={unselectedTranslations.length === 0}
            onChange={(event) => {
              if (event.target.value) updateTranslations(addCompareTranslation(preferences.translationIds, event.target.value));
            }}
            aria-label="Add translation column"
            className="max-w-48 text-sm"
          >
            <option value="">Add translation...</option>
            {unselectedTranslations.map((translation) => <option key={translation.id} value={translation.id}>{translation.abbreviation} - {translation.displayName}</option>)}
          </select>
          <button
            type="button"
            onClick={() => updateTranslations(DEFAULT_COMPARE_TRANSLATION_IDS.filter((id) => catalogue.some((item) => item.id === id)))}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            title="Restore the three embedded translations"
          >
            <RotateCcw size={14} /> Default three
          </button>
        </div>
      </header>

      {actionMessage && <div className="shrink-0 border-b border-blue-100 bg-blue-50 px-5 py-2 text-xs font-medium text-blue-700" role="status">{actionMessage}</div>}

      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4" data-compare-columns>
        {preferences.translationIds.map((translationId, index) => {
          const descriptor = catalogue.find((item) => item.id === translationId);
          if (!descriptor) return null;
          const state = columnStates[translationId] ?? { status: "loading" };
          return (
            <section key={translationId} className="flex h-full w-[24rem] min-w-[22rem] max-w-[30rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-translation-column={translationId}>
              <div className="shrink-0 border-b border-slate-200 bg-white p-3.5">
                <div className="flex items-start gap-2">
                  <GripVertical size={18} className="mt-2 shrink-0 text-slate-300" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-blue-600 px-2 py-1 text-xs font-black tracking-wide text-white">{descriptor.abbreviation}</span>
                      <span className="truncate text-sm font-bold text-slate-900">{descriptor.displayName}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1">{availabilityLabel(descriptor, state.status === "ready" ? state.passage : undefined)}</span>
                      <span>{descriptor.languageName}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button type="button" disabled={index === 0} onClick={() => updateTranslations(moveCompareTranslation(preferences.translationIds, translationId, -1))} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-25" aria-label={`Move ${descriptor.displayName} left`}><ArrowLeft size={14} /></button>
                    <button type="button" disabled={index === preferences.translationIds.length - 1} onClick={() => updateTranslations(moveCompareTranslation(preferences.translationIds, translationId, 1))} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-25" aria-label={`Move ${descriptor.displayName} right`}><ArrowRight size={14} /></button>
                    <button type="button" disabled={preferences.translationIds.length <= 1} onClick={() => updateTranslations(removeCompareTranslation(preferences.translationIds, translationId))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-25" aria-label={`Remove ${descriptor.displayName}`}><Trash2 size={14} /></button>
                  </div>
                </div>
                <select
                  value={translationId}
                  onChange={(event) => updateTranslations(replaceCompareTranslation(preferences.translationIds, translationId, event.target.value))}
                  aria-label={`Replace ${descriptor.displayName}`}
                  className="mt-3 w-full text-sm"
                >
                  {catalogue.map((option) => <option key={option.id} value={option.id} disabled={option.id !== translationId && preferences.translationIds.includes(option.id)}>{option.abbreviation} - {option.displayName}</option>)}
                </select>
              </div>

              <div
                ref={(element) => {
                  if (element) scrollContainersRef.current.set(translationId, element);
                  else scrollContainersRef.current.delete(translationId);
                }}
                onScroll={(event) => handleColumnScroll(translationId, event.currentTarget)}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
                dir={descriptor.textDirection}
                lang={descriptor.languageCode}
              >
                {state.status === "loading" && (
                  <div className="flex h-full min-h-52 flex-col items-center justify-center gap-3 text-sm text-slate-500" role="status">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                    Loading {descriptor.abbreviation}...
                  </div>
                )}
                {state.status === "error" && (
                  <div className="flex h-full min-h-52 flex-col items-center justify-center gap-3 px-5 text-center" role="alert">
                    {state.error.code === "unavailable_offline" ? <WifiOff size={26} className="text-slate-400" /> : <RefreshCw size={26} className="text-amber-500" />}
                    <p className="text-sm font-bold text-slate-800">{errorLabel(state.error)}</p>
                    <p className="text-xs leading-relaxed text-slate-500">Other translation columns remain available.</p>
                    {(state.error.retryable || state.error.code === "unavailable_offline") && (
                      <button type="button" onClick={() => void retryColumn(translationId)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Retry this chapter</button>
                    )}
                  </div>
                )}
                {state.status === "ready" && (
                  <div className="space-y-0.5">
                    {state.passage.verses.map((verse) => {
                      const verseId = `${props.book}.${props.chapter}.${verse.verse}`;
                      const speechKey = `${descriptor.id}:${verse.verse}`;
                      return (
                        <article
                          key={verse.verse}
                          data-compare-verse={verse.verse}
                          className="group rounded-xl px-2 py-3 hover:bg-slate-50"
                          draggable
                          onDragStart={(event) => {
                            const payload = { verseId, translations: [{ label: `${descriptor.abbreviation} (${descriptor.id})`, text: verse.text }] };
                            event.dataTransfer.setData("application/json-verses", JSON.stringify(payload));
                            event.dataTransfer.setData("text/plain", `${verseId} ${descriptor.abbreviation}: ${verse.text}`);
                            event.dataTransfer.effectAllowed = "copy";
                            setGlassDragImage(event, `${verseId} ${descriptor.id}`);
                            window.dispatchEvent(new CustomEvent("rhelo-drag-start", { detail: { verseId, payload } }));
                          }}
                          onDragEnd={() => window.dispatchEvent(new CustomEvent("rhelo-drag-end"))}
                        >
                          <div className="flex items-start gap-2.5">
                            <button type="button" onClick={() => handleOpenInRead(verse.verse)} className="mt-0.5 shrink-0 text-xs font-black text-blue-600 hover:underline" title="Open this verse in Read">{verse.verse}</button>
                            <p className="min-w-0 flex-1 text-[1.02rem] leading-7 text-slate-700" dir={descriptor.textDirection}>{verse.text}</p>
                            <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100" dir="ltr">
                              <button type="button" onClick={() => void handleCopy(descriptor, verse.verse, verse.text)} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700" aria-label={`Copy ${descriptor.abbreviation} ${verseId}`}><Copy size={14} /></button>
                              <button type="button" disabled={speakingKey !== null} onClick={() => void handleSpeak(descriptor, verse.verse, verse.text)} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-blue-600 disabled:opacity-30" aria-label={`Speak ${descriptor.abbreviation} ${verseId}`}>
                                {speakingKey === speechKey ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                              </button>
                              <button type="button" onClick={() => handleOpenInRead(verse.verse)} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-blue-600" aria-label={`Study ${verseId} in Read`}><ArrowRight size={14} /></button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <footer className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[10px] leading-relaxed text-slate-500" dir="ltr">
                {descriptor.attribution || descriptor.displayName}
                {descriptor.copyright ? ` · ${descriptor.copyright}` : ""}
              </footer>
            </section>
          );
        })}
        {preferencesReady && unselectedTranslations.length > 0 && (
          <label className="flex h-full min-h-72 w-72 min-w-72 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-6 text-center text-slate-500 hover:border-blue-300 hover:bg-blue-50/30">
            <Plus size={28} className="text-blue-500" />
            <span className="text-sm font-bold text-slate-700">Add translation column</span>
            <select value="" onChange={(event) => event.target.value && updateTranslations(addCompareTranslation(preferences.translationIds, event.target.value))} className="w-full text-sm" aria-label="Choose another translation">
              <option value="">Choose translation...</option>
              {unselectedTranslations.map((translation) => <option key={translation.id} value={translation.id}>{translation.abbreviation} - {translation.displayName}</option>)}
            </select>
          </label>
        )}
      </div>

      <BookChapterPickerModal
        key={`${props.book}-${props.chapter}`}
        isOpen={showBookPicker}
        onClose={() => setShowBookPicker(false)}
        selectedBook={props.book}
        selectedChapter={props.chapter}
        showTranslationPanel={false}
        onSelect={(book, chapter) => {
          props.setBook(book);
          props.setChapter(chapter);
          props.setSelectedVerseId(null);
          setShowBookPicker(false);
        }}
      />
    </div>
  );
}
