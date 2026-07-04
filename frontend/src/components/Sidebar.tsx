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
} from "lucide-react";

const NAV_ITEMS = [
  { id: "read", label: "Read", icon: BookOpen },
  { id: "search", label: "Search", icon: Search },
  { id: "map", label: "Maps", icon: Map },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "people", label: "People", icon: Users },
  { id: "dictionary", label: "Dictionary", icon: BookMarked },
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
      animate={{ width: hovered ? 220 : 64 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative h-full flex flex-col items-center border-r border-slate-200 bg-white shrink-0 z-20"
    >
      {/* Brand Header - Height strictly matched to top navbar (64px / h-16) */}
      <div className="h-16 w-full px-4 border-b border-slate-200 flex items-center shrink-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shadow-md shrink-0 bg-blue-600 text-white"
          style={{
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
          }}
        >
          rh
        </div>
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="ml-3 font-bold text-xs tracking-wider uppercase bg-clip-text text-transparent font-sans"
              style={{
                backgroundImage: "linear-gradient(to right, #0f172a, #2563eb)",
              }}
            >
              Rhema
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Main Navigation links - spaced out starting from top */}
      <nav className="flex flex-col gap-3 w-full px-3 pt-6 flex-1 justify-start">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex items-center rounded-xl transition-all duration-200 cursor-pointer relative group w-full py-3 ${
                hovered ? "justify-start px-3.5 gap-3" : "justify-center px-0"
              } ${
                isActive
                  ? "bg-blue-50 text-blue-600 font-semibold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
              title={hovered ? "" : item.label}
            >
              <Icon
                size={18}
                className="shrink-0 transition-transform duration-200 group-hover:scale-105"
              />
              
              <AnimatePresence>
                {hovered && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap overflow-hidden font-sans"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 w-1 h-5 rounded-r bg-blue-600"
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
      <div className="w-full px-2 pb-4 border-t border-slate-200 pt-3 shrink-0">
        <button
          onClick={() => onViewChange("settings")}
          className={`flex items-center rounded-xl transition-all duration-200 cursor-pointer relative group w-full py-3 ${
            hovered ? "justify-start px-3.5 gap-3" : "justify-center px-0"
          } ${
            activeView === "settings"
              ? "bg-blue-50 text-blue-600 font-semibold"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          }`}
          title={hovered ? "" : "Settings"}
        >
          <Settings
            size={18}
            className="shrink-0 transition-transform duration-200 group-hover:scale-105"
          />
          
          <AnimatePresence>
            {hovered && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap overflow-hidden font-sans"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>

          {activeView === "settings" && (
            <motion.div
              layoutId="active-indicator"
              className="absolute left-0 w-1 h-5 rounded-r bg-blue-600"
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
