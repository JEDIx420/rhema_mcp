"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Navigation, Calendar, Loader2, BookOpen } from "lucide-react";
import { fetchTimeline } from "@/lib/api";
import { getBookName } from "@/lib/books";

interface TimelineEvent {
  event_id: string;
  title: string;
  year: number;
  location: string;
  description: string;
  verses: string[];
}

interface TimelineViewProps {
  onNavigate: (book: string, chapter: number, verse?: number) => void;
  onViewChange: (view: string) => void;
}

// Major Milestones on the scrub rail
const MILESTONES = [
  { year: -2000, label: "Abraham" },
  { year: -1446, label: "Exodus" },
  { year: -1010, label: "King David" },
  { year: -586, label: "Exile" },
  { year: 4, label: "Jesus Birth" },
  { year: 70, label: "Apostolic Age" },
];

export default function TimelineView({ onNavigate, onViewChange }: TimelineViewProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrubYear, setScrubYear] = useState<number>(-1446);

  useEffect(() => {
    let active = true;
    fetchTimeline()
      .then((data) => {
        if (active) {
          setEvents(data.events || []);
          if (data.events && data.events.length > 0) {
            setScrubYear(data.events[0].year);
          }
        }
      })
      .catch(() => {
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Format year for humans
  const formatYear = (yr: number) => {
    if (yr < 0) return `${Math.abs(yr)} BC`;
    return `AD ${yr}`;
  };

  // Find the event closest to the scrub Year
  const closestEvent = useMemo(() => {
    if (events.length === 0) return null;
    return events.reduce((prev, curr) => {
      return Math.abs(curr.year - scrubYear) < Math.abs(prev.year - scrubYear) ? curr : prev;
    });
  }, [events, scrubYear]);

  const handleGoToReference = (verseId: string) => {
    if (!verseId) return;
    const parts = verseId.split(".");
    onNavigate(parts[0], parseInt(parts[1]), parseInt(parts[2] || "1"));
    onViewChange("read");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div
        className="h-16 px-6 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between shadow-sm"
      >
        <div className="flex items-center gap-2">
          <Clock size={18} style={{ color: "var(--primary)" }} />
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
            Chronological Timeline
          </h2>
        </div>
        <div className="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-600 font-semibold border border-blue-200/50">
          History Range: 2000 BC &mdash; AD 100
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-500 text-xs">
          <Loader2 className="animate-spin text-blue-500" size={24} />
          <span>Syncing chronology data...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-xs text-slate-500 italic">
          No timeline events loaded in database.
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
          
          {/* Interactive Horizontal Timeline Track */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">
              Interactive Horizontal Timeline Map
            </span>
            
            <div className="relative overflow-x-auto pb-4 pt-8 px-8 scrollbar-thin select-none">
              {/* Horizontal Line connecting events */}
              <div className="absolute top-[49px] left-0 right-0 h-0.5 bg-slate-200/80" />
              
              <div className="flex gap-16 min-w-max relative z-10">
                {events.map((item) => {
                  const isSelected = closestEvent?.event_id === item.event_id;
                  
                  return (
                    <div 
                      key={item.event_id}
                      onClick={() => setScrubYear(item.year)}
                      className="flex flex-col items-center cursor-pointer group relative w-36"
                    >
                      {/* Timeline Dot Indicator */}
                      <motion.div 
                        className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 ring-4 ring-blue-500/10 scale-125"
                            : "bg-white border-slate-300 group-hover:border-slate-500 group-hover:scale-110"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </motion.div>
                      
                      {/* Date Pill above the dot */}
                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md absolute -top-7 transition-all ${
                        isSelected 
                          ? "bg-blue-600 text-white shadow-sm" 
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                      }`}>
                        {formatYear(item.year)}
                      </span>
                      
                      {/* Event Title below the dot */}
                      <span className={`text-xs mt-3 text-center leading-normal font-semibold transition-all line-clamp-2 px-1 ${
                        isSelected 
                          ? "text-blue-600 font-bold scale-[1.03]" 
                          : "text-slate-600 group-hover:text-slate-800"
                      }`}>
                        {item.title}
                      </span>
                      
                      {/* Location subtitle */}
                      <span className="text-[9px] text-slate-400 mt-0.5 font-medium block">
                        {item.location}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lower Panel: Left Details, Right List */}
          <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
            {/* Left Column: Event details card */}
            {closestEvent && (
              <div className="flex-[3] flex flex-col bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-y-auto">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-blue-500" size={16} />
                    <span className="text-sm font-extrabold text-blue-600 uppercase tracking-wider">
                      {formatYear(closestEvent.year)}
                    </span>
                    <span className="text-slate-355">&bull;</span>
                    <span className="text-xs text-slate-500 font-semibold">{closestEvent.location}</span>
                  </div>
                  {closestEvent.verses && closestEvent.verses.length > 0 && (
                    <button
                      onClick={() => handleGoToReference(closestEvent.verses[0])}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold cursor-pointer transition-colors shadow-xs"
                    >
                      <Navigation size={12} />
                      Jump to Scripture ({closestEvent.verses[0]})
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-extrabold text-slate-850" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
                    {closestEvent.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 bg-slate-50 p-5 rounded-2xl border border-slate-200/50">
                    {closestEvent.description}
                  </p>

                  {closestEvent.verses && closestEvent.verses.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Associated Scriptures
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {closestEvent.verses.map((v) => (
                          <button
                            key={v}
                            onClick={() => handleGoToReference(v)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
                          >
                            <BookOpen size={12} className="text-slate-450" />
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Right Column: Historical List */}
            <div className="flex-[2] flex flex-col bg-white border border-slate-200 rounded-xl p-5 shadow-sm overflow-hidden">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block shrink-0">
                All Chronological Events
              </h4>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {events.map((item) => {
                  const isClosest = closestEvent?.event_id === item.event_id;
                  return (
                    <button
                      key={item.event_id}
                      onClick={() => setScrubYear(item.year)}
                      className="w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer hover:bg-slate-50/50"
                      style={{
                        background: isClosest ? "rgba(37, 99, 235, 0.04)" : "transparent",
                        borderColor: isClosest ? "rgba(37, 99, 235, 0.2)" : "rgba(15, 23, 42, 0.05)",
                      }}
                    >
                      <div className="px-2 py-1 rounded-lg font-bold text-[10px] uppercase shrink-0 text-center w-20 font-mono"
                           style={{ background: isClosest ? "rgba(37, 99, 235, 0.1)" : "rgba(15, 23, 42, 0.03)",
                                    color: isClosest ? "var(--primary)" : "var(--text-muted)" }}>
                        {formatYear(item.year)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-xs truncate">
                          {item.title}
                        </div>
                        <div className="text-slate-450 text-[9px] mt-0.5 truncate">
                          {item.location}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
