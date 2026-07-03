"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Search,
  Map,
  Clock,
  Users,
  BookMarked,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "read", label: "Read", icon: BookOpen },
  { id: "search", label: "Search", icon: Search },
  { id: "map", label: "Maps", icon: Map },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "people", label: "People", icon: Users },
  { id: "dictionary", label: "Dictionary", icon: BookMarked },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  activeView,
  onViewChange,
}: {
  activeView: string;
  onViewChange: (view: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.aside
      animate={{ width: expanded ? 200 : 64 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="relative flex flex-col items-center py-4 border-r shrink-0"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center w-full px-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: "var(--primary)", color: "var(--bg-base)" }}
        >
          R
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="ml-3 font-semibold text-sm whitespace-nowrap overflow-hidden"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Rhema
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 w-full px-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer"
              style={{
                background: isActive
                  ? "rgba(52, 211, 153, 0.12)"
                  : "transparent",
                color: isActive ? "var(--primary)" : "var(--text-muted)",
              }}
              title={item.label}
            >
              <Icon size={20} className="shrink-0" />
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-sm whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Expand Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-auto mb-2 p-2 rounded-lg transition-colors cursor-pointer"
        style={{ color: "var(--text-muted)" }}
      >
        {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </motion.aside>
  );
}
