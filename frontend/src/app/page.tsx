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

export default function Home() {
  const [activeView, setActiveView] = useState("read");
  const [book, setBook] = useState("GEN");
  const [chapter, setChapter] = useState(1);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>("Adam_1");

  // Drag-and-drop overlays state
  const [draggedVerse, setDraggedVerse] = useState<{ verseId: string; verseText: string } | null>(null);

  // STT Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // Listen to session update notifications to force refresh
  useEffect(() => {
    const handleSessionUpdated = () => {
      // Force trigger state updates across panels if active
    };
    window.addEventListener("rhema-session-updated", handleSessionUpdated);
    return () => window.removeEventListener("rhema-session-updated", handleSessionUpdated);
  }, []);

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
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(",")[1];
          try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050";
            const res = await fetch(`${apiBase}/api/stt`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64Data, language_code: "en" })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text) {
                const sessionsRes = await fetchSessions();
                const sessions = sessionsRes.sessions || [];
                if (sessions.length > 0) {
                  const latest = sessions[0];
                  const updatedContent = (latest.content || "") + `<p>${data.text}</p>`;
                  await updateSession(latest.session_id, latest.title, updatedContent);
                  
                  window.dispatchEvent(new CustomEvent("rhema-session-updated"));
                  setActiveView("sessions");
                }
              }
            }
          } catch (err) {
            console.error("STT transcribing error", err);
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
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 z-50 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-full flex items-center gap-3 shadow-xl text-white"
          >
            <div className="flex gap-1 items-center h-4">
              <span className="w-0.5 bg-blue-400 h-2 animate-bounce rounded" style={{ animationDelay: '0.1s' }} />
              <span className="w-0.5 bg-blue-400 h-4 animate-bounce rounded" style={{ animationDelay: '0.2s' }} />
              <span className="w-0.5 bg-blue-400 h-1 animate-bounce rounded" style={{ animationDelay: '0.3s' }} />
              <span className="w-0.5 bg-blue-400 h-3 animate-bounce rounded" style={{ animationDelay: '0.4s' }} />
            </div>
            <span className="text-xs font-bold font-sans pr-1">Speech Dictation Active...</span>
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
            className="fixed bottom-6 right-6 z-50 p-5 rounded-2xl border-2 border-dashed border-blue-400 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center gap-2 pointer-events-auto"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const verseId = e.dataTransfer.getData("application/verse-id");
              const verseText = e.dataTransfer.getData("text/plain");
              if (verseId && verseText) {
                try {
                  const sessionsRes = await fetchSessions();
                  const sessions = sessionsRes.sessions || [];
                  if (sessions.length > 0) {
                    const latest = sessions[0];
                    const updatedContent = (latest.content || "") + 
                      `<blockquote class="border-l-4 border-blue-500 pl-4 my-4 py-1 italic bg-slate-50 rounded-r-lg pr-4 font-serif text-slate-700"><strong>${verseId}</strong>: &ldquo;${verseText}&rdquo;</blockquote><p></p>`;
                    await updateSession(latest.session_id, latest.title, updatedContent);
                    
                    window.dispatchEvent(new CustomEvent("rhema-session-updated"));
                    setActiveView("sessions");
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
            <p className="text-sm font-bold text-slate-800 font-sans">Drop here to save verse</p>
            <p className="text-[11px] text-slate-400 font-sans">Appends quote block to latest session</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Floating Voice Dictation mic toggle */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`fixed bottom-6 z-40 p-4.5 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center border border-white/20 ${
          isRecording 
            ? "bg-red-600 text-white animate-pulse" 
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
        title={isRecording ? "Stop dictation" : "Start speech dictation"}
        style={{ right: draggedVerse ? "260px" : "24px" }}
      >
        <Mic size={22} />
      </button>
    </div>
  );
}
