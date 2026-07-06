"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";

interface PdfViewerProps {
  url: string;
  filename: string;
  onClose: () => void;
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function PdfViewer({ url, filename, onClose }: PdfViewerProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("The PDF could not be downloaded.");
      const blob = await response.blob();

      if (isTauriRuntime()) {
        const [{ save }, { writeFile }] = await Promise.all([
          import("@tauri-apps/plugin-dialog"),
          import("@tauri-apps/plugin-fs"),
        ]);
        const path = await save({
          defaultPath: filename,
          filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        });

        if (path) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          await writeFile(path, bytes);
        }
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("PDF download failed", error);
      setDownloadError(error instanceof Error ? error.message : "The PDF could not be saved.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-sm">
      <iframe
        src={url}
        title={`PDF preview: ${filename}`}
        className="h-full w-full border-0 bg-slate-100"
      />

      <div className="fixed right-6 top-6 z-[110] flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex h-11 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-bold text-white shadow-lg transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:bg-blue-400"
          aria-label="Download PDF"
          title="Download PDF"
        >
          {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          <span>Download</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg transition-colors hover:bg-slate-100"
          aria-label="Close PDF preview"
          title="Close PDF preview"
        >
          <X size={22} />
        </button>
      </div>

      {downloadError && (
        <div className="fixed right-6 top-20 z-[110] max-w-sm rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg">
          {downloadError}
        </div>
      )}
    </div>
  );
}
