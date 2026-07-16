"use client";

import { useTtsDetector } from "@/hooks/useTtsDetector";
import { openSpeechSettings } from "@/utils/SystemHelper";

export const TtsWarning = () => {
  const status = useTtsDetector("el-GR");

  if (status !== "missing") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-lg">
      <h3 className="text-sm font-bold text-amber-800">Greek Voice Missing</h3>
      <p className="mt-1 text-xs text-amber-700">
        We couldn&apos;t detect a Greek voice pack on your system.
      </p>
      <button
        onClick={openSpeechSettings}
        className="mt-3 w-full rounded bg-amber-600 px-3 py-1.5 text-xs text-white transition hover:bg-amber-700"
      >
        Open Settings
      </button>
    </div>
  );
};
