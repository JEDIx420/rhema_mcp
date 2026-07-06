"use client";

import { useState } from "react";
import { X, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { BIBLE_BOOKS, getBookName } from "@/lib/books";

interface BookChapterPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBook: string;
  selectedChapter: number;
  onSelect: (book: string, chapter: number) => void;
}

export default function BookChapterPickerModal({
  isOpen,
  onClose,
  selectedBook,
  selectedChapter,
  onSelect
}: BookChapterPickerModalProps) {
  const [step, setStep] = useState<"book" | "chapter">("book");
  const [tempBook, setTempBook] = useState<string>(selectedBook);

  if (!isOpen) return null;

  const bookInfo = BIBLE_BOOKS.find((b) => b.code === tempBook);
  const totalChapters = bookInfo?.chapters || 1;
  const chaptersList = Array.from({ length: totalChapters }, (_, i) => i + 1);

  const handleBookSelect = (bookCode: string) => {
    setTempBook(bookCode);
    setStep("chapter");
  };

  const handleChapterSelect = (chapterNum: number) => {
    onSelect(tempBook, chapterNum);
    setStep("book"); // reset
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-md"
        onClick={onClose}
      />
      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white/95 backdrop-blur-lg border border-slate-200/60 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            {step === "chapter" && (
              <button 
                onClick={() => setStep("book")}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <h3 className="text-base font-bold text-slate-800 font-sans" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
              {step === "book" ? "Select Scripture Book" : `Select Chapter in ${getBookName(tempBook)}`}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-modal-scroll">
          {step === "book" ? (
            <div className="space-y-5">
              {/* Old Testament */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 font-sans">
                  Old Testament
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {BIBLE_BOOKS.filter((b) => b.testament === "OT").map((b) => (
                    <button
                      key={b.code}
                      onClick={() => handleBookSelect(b.code)}
                      className={`px-3 py-2 text-sm text-center rounded-xl border transition-all cursor-pointer font-semibold font-sans ${
                        b.code === selectedBook 
                          ? "bg-blue-50 text-blue-600 border-blue-200 shadow-xs" 
                          : "bg-white text-slate-600 border-slate-200/80 hover:border-blue-200 hover:bg-slate-50/50"
                      }`}
                      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* New Testament */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 font-sans">
                  New Testament
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {BIBLE_BOOKS.filter((b) => b.testament === "NT").map((b) => (
                    <button
                      key={b.code}
                      onClick={() => handleBookSelect(b.code)}
                      className={`px-3 py-2 text-sm text-center rounded-xl border transition-all cursor-pointer font-semibold font-sans ${
                        b.code === selectedBook 
                          ? "bg-blue-50 text-blue-600 border-blue-200 shadow-xs" 
                          : "bg-white text-slate-600 border-slate-200/80 hover:border-blue-200 hover:bg-slate-50/50"
                      }`}
                      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
              {chaptersList.map((ch) => (
                <button
                  key={ch}
                  onClick={() => handleChapterSelect(ch)}
                  className={`h-10 text-sm font-semibold rounded-xl border flex items-center justify-center transition-all cursor-pointer font-sans ${
                    tempBook === selectedBook && ch === selectedChapter 
                      ? "bg-blue-50 text-blue-600 border-blue-200 shadow-xs" 
                      : "bg-white text-slate-600 border-slate-200/80 hover:border-blue-200 hover:bg-slate-50/50"
                  }`}
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
