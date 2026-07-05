"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import ReadingDesk from "@/components/ReadingDesk";
import SearchView from "@/components/SearchView";
import DictionaryView from "@/components/DictionaryView";
import MapView from "@/components/MapView";
import TimelineView from "@/components/TimelineView";
import GenealogyView from "@/components/GenealogyView";
import SettingsView from "@/components/SettingsView";
import SessionsView from "@/components/SessionsView";
import CommandCenter from "@/components/CommandCenter";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Save } from "lucide-react";
import { fetchSessions, updateSession } from "@/lib/api";

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

export default function Home() {
  const [activeView, setActiveView] = useState("read");
  const [book, setBook] = useState("GEN");
  const [chapter, setChapter] = useState(1);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>("Adam_1");

  // Drag-and-drop overlays state
  const [draggedVerse, setDraggedVerse] = useState<{ verseId: string; verseText: string } | null>(null);

  // Active session states
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState<string | null>(null);
  const [studySessionsList, setStudySessionsList] = useState<any[]>([]);

  // STT Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // STT Dictation review modal states
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [isProcessingSTT, setIsProcessingSTT] = useState(false);
  const [reviewTargetSessionId, setReviewTargetSessionId] = useState<string | null>(null);

  // Track window drag listeners
  useEffect(() => {
    const handleDragStartEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDraggedVerse({
          verseId: customEvent.detail.verseId,
          verseText: customEvent.detail.verseText
        });
      }
    };

    const handleDragEndEvent = () => {
      setDraggedVerse(null);
    };

    window.addEventListener("rhema-drag-start", handleDragStartEvent);
    window.addEventListener("rhema-drag-end", handleDragEndEvent);

    return () => {
      window.removeEventListener("rhema-drag-start", handleDragStartEvent);
      window.removeEventListener("rhema-drag-end", handleDragEndEvent);
    };
  }, []);

  // Sync active session selection globally
  useEffect(() => {
    const handleActiveSessionChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveSessionId(customEvent.detail.sessionId);
        setActiveSessionTitle(customEvent.detail.title);
      }
    };
    window.addEventListener("rhema-active-session-changed", handleActiveSessionChanged);
    return () => window.removeEventListener("rhema-active-session-changed", handleActiveSessionChanged);
  }, []);

  // Fetch initial active session list and selection
  useEffect(() => {
    const initActiveSession = async () => {
      try {
        const res = await fetchSessions();
        const list = res.sessions || [];
        setStudySessionsList(list);
        if (list.length > 0 && !activeSessionId) {
          setActiveSessionId(list[0].session_id);
          setActiveSessionTitle(list[0].title);
        }
      } catch (err) {
        console.error(err);
      }
    };
    initActiveSession();
    
    const handleSessionUpdated = () => {
      initActiveSession();
    };
    window.addEventListener("rhema-session-updated", handleSessionUpdated);
    return () => window.removeEventListener("rhema-session-updated", handleSessionUpdated);
  }, [activeSessionId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessingSTT(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(",")[1];
          try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5050";
            const res = await fetch(`${apiBase}/api/stt`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64Data, language_code: "en" })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text) {
                setTranscribedText(data.text);
                setReviewTargetSessionId(activeSessionId);
              } else {
                alert("Speech recognition was unable to capture any words. Please try again.");
              }
            } else {
              alert("Speech recognition server error. Please try again.");
            }
          } catch (err) {
            console.error("STT transcribing error", err);
          } finally {
            setIsProcessingSTT(false);
          }
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleConfirmTranscription = async () => {
    if (!reviewTargetSessionId || !transcribedText || !transcribedText.trim()) return;
    try {
      const targetSession = studySessionsList.find(s => s.session_id === reviewTargetSessionId);
      if (!targetSession) return;
      
      const contentWithDate = addDateHeaderIfNeeded(targetSession.content || "");
      const timestamp = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
      
      const updatedContent = contentWithDate + `<p><strong>[${timestamp}]</strong>: ${transcribedText.trim()}</p>`;
      await updateSession(reviewTargetSessionId, targetSession.title, updatedContent);
      
      window.dispatchEvent(new CustomEvent("rhema-session-updated"));
      window.dispatchEvent(new CustomEvent("rhema-active-session-changed", {
        detail: { sessionId: reviewTargetSessionId, title: targetSession.title }
      }));
      
      setTranscribedText(null);
      setActiveView("sessions");
    } catch (err) {
      console.error(err);
    }
  };

  const handleNavigate = (b: string, c: number, v?: number) => {
    setBook(b);
    setChapter(c);
    if (v) {
      setSelectedVerseId(`${b}.${c}.${v}`);
    } else {
      setSelectedVerseId(null);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case "read":
        return (
          <ReadingDesk
            book={book}
            chapter={chapter}
            setBook={setBook}
            setChapter={setChapter}
            selectedVerseId={selectedVerseId}
            setSelectedVerseId={setSelectedVerseId}
            onViewChange={setActiveView}
          />
        );
      case "search":
        return (
          <SearchView
            onNavigate={handleNavigate}
            onViewChange={setActiveView}
          />
        );
      case "dictionary":
        return <DictionaryView />;
      case "map":
        return (
          <MapView
            book={book}
            chapter={chapter}
            onNavigate={handleNavigate}
          />
        );
      case "timeline":
        return (
          <TimelineView
            onNavigate={handleNavigate}
            onViewChange={setActiveView}
          />
        );
      case "people":
        return (
          <GenealogyView
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            onNavigate={handleNavigate}
            onViewChange={setActiveView}
          />
        );
      case "sessions":
        return <SessionsView />;
      case "settings":
        return <SettingsView />;
      default:
        return (
          <ReadingDesk
            book={book}
            chapter={chapter}
            setBook={setBook}
            setChapter={setChapter}
            selectedVerseId={selectedVerseId}
            setSelectedVerseId={setSelectedVerseId}
            onViewChange={setActiveView}
          />
        );
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 relative">
      {/* CommandCenter Keyboard-Activated Command Launcher */}
      <CommandCenter
        onNavigate={handleNavigate}
        onSelectPerson={setSelectedPersonId}
        onViewChange={setActiveView}
      />

      {/* Persistent Sidebar */}
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
      {/* Main Panel Viewport */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- FLOATING WORKSPACE OVERLAYS --- */}

      {/* 1. Listening Waveform Pill (STT Dictation Mode) */}
      <AnimatePresence>
        {(isRecording || isProcessingSTT) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 z-[2000] px-4 py-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-full flex items-center gap-3 shadow-xl text-white font-sans"
          >
            {isRecording ? (
              <>
                <div className="flex gap-1 items-center h-4">
                  <span className="w-0.5 bg-blue-400 h-2 animate-bounce rounded" style={{ animationDelay: '0.1s' }} />
                  <span className="w-0.5 bg-blue-400 h-4 animate-bounce rounded" style={{ animationDelay: '0.2s' }} />
                  <span className="w-0.5 bg-blue-400 h-1 animate-bounce rounded" style={{ animationDelay: '0.3s' }} />
                  <span className="w-0.5 bg-blue-400 h-3 animate-bounce rounded" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="text-xs font-bold pr-1">Speech Dictation Active...</span>
              </>
            ) : (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span className="text-xs font-bold pr-1">Transcribing Speech...</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Magnetic Drop Zone overlay */}
      <AnimatePresence>
        {draggedVerse && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-6 right-6 z-[2000] p-5 rounded-2xl border-2 border-dashed border-blue-400 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center gap-2 pointer-events-auto"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const verseId = e.dataTransfer.getData("application/verse-id");
              const verseText = e.dataTransfer.getData("text/plain");
              if (verseId && verseText) {
                try {
                  const targetSessionId = activeSessionId;
                  if (targetSessionId) {
                    const targetSession = studySessionsList.find(s => s.session_id === targetSessionId);
                    if (targetSession) {
                      const contentWithDate = addDateHeaderIfNeeded(targetSession.content || "");
                      const updatedContent = contentWithDate + 
                        `<blockquote class="border-l-4 border-blue-500 pl-4 my-4 py-1 italic bg-slate-50 rounded-r-lg pr-4 font-serif text-slate-700"><strong>${verseId}</strong>: &ldquo;${verseText}&rdquo;</blockquote><p></p>`;
                      await updateSession(targetSession.session_id, targetSession.title, updatedContent);
                      
                      window.dispatchEvent(new CustomEvent("rhema-session-updated"));
                      setActiveView("sessions");
                    }
                  } else {
                    const sessionsRes = await fetchSessions();
                    const sessions = sessionsRes.sessions || [];
                    if (sessions.length > 0) {
                      const latest = sessions[0];
                      const contentWithDate = addDateHeaderIfNeeded(latest.content || "");
                      const updatedContent = contentWithDate + 
                        `<blockquote class="border-l-4 border-blue-500 pl-4 my-4 py-1 italic bg-slate-50 rounded-r-lg pr-4 font-serif text-slate-700"><strong>${verseId}</strong>: &ldquo;${verseText}&rdquo;</blockquote><p></p>`;
                      await updateSession(latest.session_id, latest.title, updatedContent);
                      
                      window.dispatchEvent(new CustomEvent("rhema-session-updated"));
                      setActiveView("sessions");
                    }
                  }
                } catch (err) {
                  console.error(err);
                }
              }
              setDraggedVerse(null);
            }}
          >
            <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 animate-bounce">
              <Save size={20} />
            </div>
            <p className="text-sm font-bold text-slate-800 font-sans">Drop here to save reference</p>
            <p className="text-[11px] text-slate-400 font-sans">Appends to: <strong className="text-blue-600">{activeSessionTitle || "latest session"}</strong></p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Floating Voice Dictation mic toggle */}
      <div 
        className="fixed bottom-6 z-[1900] flex items-center gap-2 group/mic"
        style={{ right: draggedVerse ? "260px" : "24px" }}
      >
        <span className="opacity-0 group-hover/mic:opacity-100 transition-opacity bg-slate-900/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-md pointer-events-none uppercase tracking-wider font-sans whitespace-nowrap">
          {isRecording ? "Recording... Click to Stop" : "Voice Dictation"}
        </span>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-4.5 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center border border-white/20 ${
            isRecording 
              ? "bg-red-600 text-white animate-pulse" 
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          title={isRecording ? "Stop dictation" : "Start speech dictation"}
        >
          <Mic size={22} />
        </button>
      </div>

      {/* STT Dictation Review Modal */}
      <AnimatePresence>
        {transcribedText !== null && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-xs">
            <div className="fixed inset-0" onClick={() => setTranscribedText(null)} />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white border border-slate-200 shadow-2xl rounded-3xl w-full max-w-xl p-6 flex flex-col gap-4 font-sans z-[3010]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-extrabold text-lg text-slate-900 font-sans">
                  Dictation Review
                </h4>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                  Speech-to-Text
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
                  Transcribed Text
                </label>
                <textarea
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  className="w-full h-24 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans leading-relaxed resize-none"
                  placeholder="Captured speech will appear here..."
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">
                  Target Study Log
                </label>
                <select
                  value={reviewTargetSessionId || ""}
                  onChange={(e) => setReviewTargetSessionId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm cursor-pointer font-sans"
                >
                  {studySessionsList.length === 0 ? (
                    <option value="">No sessions available</option>
                  ) : (
                    studySessionsList.map((s) => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setTranscribedText(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer font-sans"
                >
                  Discard
                </button>
                <button
                  onClick={handleConfirmTranscription}
                  disabled={!reviewTargetSessionId || !transcribedText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer font-sans"
                >
                  Confirm & Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
