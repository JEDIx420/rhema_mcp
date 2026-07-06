export interface VerseTranslationLine {
  label: string;
  text: string;
}

export interface VerseDragPayload {
  verseId: string;
  translations: VerseTranslationLine[];
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function readVerseDragPayload(dataTransfer: DataTransfer): VerseDragPayload | null {
  const structuredPayload = dataTransfer.getData("application/json-verses");
  if (structuredPayload) {
    try {
      const parsed = JSON.parse(structuredPayload) as Partial<VerseDragPayload>;
      if (typeof parsed.verseId === "string" && Array.isArray(parsed.translations)) {
        const translations = parsed.translations.filter(
          (item): item is VerseTranslationLine =>
            typeof item?.label === "string" && typeof item?.text === "string" && item.text.trim().length > 0,
        );
        if (translations.length > 0) return { verseId: parsed.verseId, translations };
      }
    } catch (error) {
      console.error("Failed to parse Rhelo verse drag payload", error);
    }
  }

  const verseId = dataTransfer.getData("application/verse-id");
  const verseText = dataTransfer.getData("text/plain");
  if (!verseId || !verseText) return null;
  return { verseId, translations: [{ label: "Verse", text: verseText }] };
}

export function renderVerseDropHtml(payload: VerseDragPayload): string {
  const verseId = escapeHtml(payload.verseId);
  return payload.translations
    .map(({ label, text }) => {
      const safeLabel = escapeHtml(label);
      const safeText = escapeHtml(text);
      return `<blockquote class="border-l-4 border-blue-500 pl-4 my-4 py-2 bg-slate-50 rounded-r-lg pr-4 font-serif text-slate-700"><p><strong>${verseId} · ${safeLabel}</strong></p><p>${safeText}</p></blockquote><p></p>`;
    })
    .join("");
}
