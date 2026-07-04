"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import ReadingDesk from "@/components/ReadingDesk";
import SearchView from "@/components/SearchView";
import DictionaryView from "@/components/DictionaryView";
import MapView from "@/components/MapView";
import TimelineView from "@/components/TimelineView";
import GenealogyView from "@/components/GenealogyView";
import SettingsView from "@/components/SettingsView";
import CommandCenter from "@/components/CommandCenter";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [activeView, setActiveView] = useState("read");
  const [book, setBook] = useState("GEN");
  const [chapter, setChapter] = useState(1);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>("Adam_1");

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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
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
    </div>
  );
}
