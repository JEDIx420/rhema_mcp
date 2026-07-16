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
  Notebook,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "read", label: "Read", icon: BookOpen },
  { id: "search", label: "Search", icon: Search },
  { id: "map", label: "Maps", icon: Map },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "people", label: "People", icon: Users },
  { id: "dictionary", label: "Dictionary", icon: BookMarked },
  { id: "sessions", label: "Sessions", icon: Notebook },
];

export default function Sidebar({
  activeView,
  onViewChange,
}: {
  activeView: string;
  onViewChange: (view: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ width: hovered ? 240 : 72 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative h-full flex flex-col items-center border-r border-slate-200 bg-white shrink-0 z-20 print-hide-shell-sidebar"
    >
      {/* Brand Header - Height strictly matched to top navbar (64px / h-16) */}
      <div className="h-16 w-full px-4.5 border-b border-slate-200 flex items-center shrink-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-50 border border-slate-200/60 shadow-xs"
        >
          <img
            src="/rhelo-logo.png"
            alt="Rhelo"
            className="h-10 w-10 object-contain"
          />
        </div>
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="ml-3 font-bold text-sm tracking-wider lowercase bg-clip-text text-transparent font-sans"
              style={{
                backgroundImage: "linear-gradient(to right, #0f172a, #2563eb)",
              }}
            >
              rhelo
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Main Navigation links - spaced out starting from top */}
      <nav className="flex flex-col gap-3 w-full px-3.5 pt-6 flex-1 justify-start">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex items-center rounded-xl transition-all duration-200 cursor-pointer relative group w-full py-3.5 ${
                hovered ? "justify-start px-4 gap-3.5" : "justify-center px-0"
              } ${
                isActive
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
              title={hovered ? "" : item.label}
            >
              <Icon
                size={20}
                className="shrink-0 transition-transform duration-200 group-hover:scale-105"
              />
              
              <AnimatePresence>
                {hovered && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    className="text-base font-semibold whitespace-nowrap overflow-hidden font-sans"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 w-1.5 h-6 rounded-r bg-blue-600"
                  style={{
                    boxShadow: "0 0 10px rgba(37, 99, 235, 0.6)",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section - Settings aligned at the bottom */}
      <div className="w-full px-3 pt-3 pb-5 border-t border-slate-200 shrink-0">
        <button
          onClick={() => onViewChange("settings")}
          className={`flex items-center rounded-xl transition-all duration-200 cursor-pointer relative group w-full py-3.5 ${
            hovered ? "justify-start px-4 gap-3.5" : "justify-center px-0"
          } ${
            activeView === "settings"
              ? "bg-blue-50 text-blue-600 font-semibold"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          }`}
          title={hovered ? "" : "Settings"}
        >
          <Settings
            size={20}
            className="shrink-0 transition-transform duration-200 group-hover:scale-105"
          />
          
          <AnimatePresence>
            {hovered && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="text-base font-semibold whitespace-nowrap overflow-hidden font-sans"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>

          {activeView === "settings" && (
            <motion.div
              layoutId="active-indicator"
              className="absolute left-0 w-1.5 h-6 rounded-r bg-blue-600"
              style={{
                boxShadow: "0 0 10px rgba(37, 99, 235, 0.6)",
              }}
            />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
