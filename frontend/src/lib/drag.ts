/**
 * Utility to set a beautiful, premium glassmorphism drag image for HTML5 drag-and-drop operations.
 */
export function setGlassDragImage(e: any, text: string) {
  if (!e.dataTransfer || typeof document === "undefined") return;

  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.top = "-1000px";
  el.style.left = "-1000px";
  el.style.padding = "8px 14px";
  el.style.background = "rgba(255, 255, 255, 0.7)";
  el.style.backdropFilter = "blur(12px) saturate(180%)";
  // @ts-ignore
  el.style.webkitBackdropFilter = "blur(12px) saturate(180%)";
  el.style.border = "1px solid rgba(255, 255, 255, 0.5)";
  el.style.borderRadius = "12px";
  el.style.boxShadow = "0 8px 32px 0 rgba(31, 38, 135, 0.1)";
  el.style.color = "#1e293b";
  el.style.fontSize = "12px";
  el.style.fontWeight = "600";
  el.style.fontFamily = "var(--font-sans), system-ui, -apple-system, sans-serif";
  el.style.whiteSpace = "nowrap";
  el.style.pointerEvents = "none";
  el.style.display = "inline-flex";
  el.style.alignItems = "center";
  el.style.gap = "8px";
  el.style.zIndex = "-1000";

  // Clean and truncate text if it is too long
  const cleanText = text.length > 30 ? text.substring(0, 30) + "..." : text;

  // Render a nice looking emoji-glowing pill
  el.innerHTML = `
    <span style="color: #2563eb; letter-spacing: -0.01em;">${cleanText}</span>
  `;

  document.body.appendChild(el);
  
  // Set the drag image offset slightly to follow the cursor nicely
  e.dataTransfer.setDragImage(el, 20, 20);

  // Keep the drag image mounted for the full WebKit drag session.
  window.addEventListener("dragend", () => {
    if (document.body.contains(el)) {
      document.body.removeChild(el);
    }
  }, { once: true });
}
