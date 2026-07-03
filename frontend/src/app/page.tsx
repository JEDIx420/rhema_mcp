"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import ReadingDesk from "@/components/ReadingDesk";
import SearchView from "@/components/SearchView";
import DictionaryView from "@/components/DictionaryView";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Map, Users, Settings } from "lucide-react";

function PlaceholderView({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Icon size={64} className="mx-auto mb-4 opacity-15" style={{ color: "var(--primary)" }} />
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>{title}</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState("read");

  const renderView = () => {
    switch (activeView) {
      case "read":
        return <ReadingDesk />;
      case "search":
        return <SearchView />;
      case "dictionary":
        return <DictionaryView />;
      case "map":
        return <PlaceholderView icon={Map} title="Geography & Maps" subtitle="Interactive maps with geocoded biblical locations. Coming soon." />;
      case "timeline":
        return <PlaceholderView icon={Clock} title="Chronological Timeline" subtitle="Interactive timeline of biblical events. Coming soon." />;
      case "people":
        return <PlaceholderView icon={Users} title="People & Genealogy" subtitle="Biographical profiles and family trees. Coming soon." />;
      case "settings":
        return <PlaceholderView icon={Settings} title="Settings" subtitle="Server configuration and translation downloads. Coming soon." />;
      default:
        return <ReadingDesk />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
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
