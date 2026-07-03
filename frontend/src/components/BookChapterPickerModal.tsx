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
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
        onClick={onClose}
      />
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden z-10"
      >
        {/* Header */}
        <div className="h-14 border-b flex items-center justify-between px-5 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2">
            {step === "chapter" && (
              <button 
                onClick={() => setStep("book")}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <h3 className="font-bold text-sm text-slate-800">
              {step === "book" ? "Select Scripture Book" : `Select Chapter in ${getBookName(tempBook)}`}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "book" ? (
            <div className="space-y-4">
              {/* Old Testament */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Old Testament
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {BIBLE_BOOKS.filter((b) => b.testament === "OT").map((b) => (
                    <button
                      key={b.code}
                      onClick={() => handleBookSelect(b.code)}
                      className="px-2.5 py-1.5 text-xs text-center rounded-lg border transition-all cursor-pointer font-medium"
                      style={{
                        background: b.code === selectedBook ? "rgba(37, 99, 235, 0.05)" : "transparent",
                        borderColor: b.code === selectedBook ? "rgba(37, 99, 235, 0.15)" : "rgba(15, 23, 42, 0.05)",
                        color: b.code === selectedBook ? "var(--primary)" : "var(--text-muted)"
                      }}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* New Testament */}
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  New Testament
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {BIBLE_BOOKS.filter((b) => b.testament === "NT").map((b) => (
                    <button
                      key={b.code}
                      onClick={() => handleBookSelect(b.code)}
                      className="px-2.5 py-1.5 text-xs text-center rounded-lg border transition-all cursor-pointer font-medium"
                      style={{
                        background: b.code === selectedBook ? "rgba(37, 99, 235, 0.05)" : "transparent",
                        borderColor: b.code === selectedBook ? "rgba(37, 99, 235, 0.15)" : "rgba(15, 23, 42, 0.05)",
                        color: b.code === selectedBook ? "var(--primary)" : "var(--text-muted)"
                      }}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {chaptersList.map((ch) => (
                <button
                  key={ch}
                  onClick={() => handleChapterSelect(ch)}
                  className="h-10 text-xs font-semibold rounded-lg border flex items-center justify-center transition-all cursor-pointer"
                  style={{
                    background: tempBook === selectedBook && ch === selectedChapter ? "rgba(37, 99, 235, 0.05)" : "transparent",
                    borderColor: tempBook === selectedBook && ch === selectedChapter ? "rgba(37, 99, 235, 0.2)" : "rgba(15, 23, 42, 0.05)",
                    color: tempBook === selectedBook && ch === selectedChapter ? "var(--primary)" : "var(--text-primary)"
                  }}
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
