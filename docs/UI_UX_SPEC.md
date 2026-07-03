# Rhema UI/UX Specification & Design System Manual

This document serves as the comprehensive design and interactive behavior manual for building the Rhema front-end application (Next.js / Tauri / Docker Web).

---

## 🎨 1. Design System & Style Tokens (zenrev aesthetics)

### CSS Variables & Tailored HSL Theme
```css
:root {
  /* HSL Tailored Palettes - Sleek Command Center Dark Mode */
  --bg-base: hsl(220, 15%, 8%);         /* Main backdrop */
  --bg-surface: hsl(220, 12%, 14%);     /* Cards, sidebars, panes */
  --bg-surface-elevated: hsl(220, 10%, 20%); /* Popovers, tooltips */
  
  --border-subtle: hsl(220, 12%, 22%);  /* Pane dividers */
  --border-focus: hsl(142, 70%, 45%);   /* Active focus rings */
  
  --primary: hsl(142, 70%, 45%);        /* Emerald - Success, active states */
  --primary-hover: hsl(142, 75%, 55%);
  --secondary: hsl(200, 80%, 60%);      /* Cyan - Secondary actions, timeline */
  --accent: hsl(280, 75%, 65%);         /* Purple - Lexicon and Strong's links */
  
  --text-primary: hsl(0, 0%, 95%);
  --text-muted: hsl(220, 8%, 65%);
  --text-accent: hsl(142, 80%, 75%);
  
  /* Glassmorphism settings */
  --glass-blur: blur(16px);
  --glass-opacity: rgba(20, 24, 33, 0.75);
  --glass-border: rgba(255, 255, 255, 0.08);
}
```

### Typography Settings
*   **Interface controls**: `font-family: 'Outfit', sans-serif;` (weight 400 for text, 600 for headings/buttons).
*   **Scripture columns**: `font-family: 'Inter', sans-serif;` (optimal tracking and line height `1.75` for dense reading).
*   **Hebrew/Greek scripts**: `font-family: 'SBL Hebrew', 'SBL Greek', 'Noto Serif Hebrew', serif;` (proper rendering of diacritics and vowel points).

---

## 🖥️ 2. Screen Anatomy & Layout Framework

The application is structured into a persistent 3-column layout that shifts dynamically depending on viewport constraints and active overlays.

```
+-------------------------------------------------------------------------------------------------------+
|  [SB]  |  [Header Bar: Book Selector | Cmd+K Launcher | Connection Status]               |  [LD]      |
|  - H   |---------------------------------------------------------------------------------|  (Slides   |
|  - R   |  [Interlinear Reading Desk - Verses Columns]                                    |   out on   |
|  - M   |  +--------------------+--------------------+--------------------+---------------+   word     |
|  - T   |  | Column 1: English  | Column 2: Hebrew   | Column 3: Hindi    | Col 4: Malayalam  click)  |
|  - S   |  |                    |                    |                    |               |            |
|  - B   |  | [GEN.1.1] In the   | [GEN.1.1] בְּרֵאשִׁ֖ית | आदि में परमेश्वर..  | ആദിയിൽ ദൈവം.. | [H7225]    |
|        |  | beginning...       | בָּרָ֣א...          |                    |               | resheet    |
|        |  +--------------------+--------------------+--------------------+---------------+            |
|        |                                                                                 | "beginning"|
|        |  [Bottom Tab Deck: Chronological Timeline Slider | Geography Map Canvas]       |            |
+------------------------------------------------------------------------------------------+------------+
```

### Screen 1: Persistent Sidebar (SB)
*   **Width**: Fixed `64px` (collapsed icon-only state) or `220px` (expanded text list).
*   **Icons & Actions**:
    *   `Home` (Dashboard overview, study streaks, quick resume).
    *   `Read` (Interlinear reading desk desk).
    *   `Map` (GIS Geocoding mapping explorer).
    *   `Timeline` (Chronological timeline slider and event list).
    *   `Genealogy` (Biographical profiling and family tree canvas).
    *   `Dictionary` (Nave's / Easton's / Smith's dictionary lookup desk).
    *   `Settings` (Server sync, translation downloads, backup management).

---

## 📖 3. Interactive Components Specification

### A. The Interlinear Reading Desk
*   **Column Customizer**: A top-bar dropdown allowing users to toggle visible columns (KJV English, Hebrew WLC / Greek MorphGNT, Hindi, Malayalam, Tamil, Telugu).
*   **Word-Level Hovering**:
    *   Hovering over any Hebrew/Greek word adds a subtle border highlight: `box-shadow: 0 0 0 1px var(--primary)` and scales the text by `1.02`.
    *   Displays a lightweight inline tooltip showing the transliterated word and basic Strong's root definition.
    *   Clicking the word locks the **Lexicon Drawer** open on the right pane.
*   **Verse Actions Context Menu**:
    *   Clicking a verse number (e.g. `[GEN.1.1]`) displays a floating overlay options bubble:
        1.  `Copy Verse Reference`
        2.  `View Matthew Henry Commentary` (opens bottom pane).
        3.  `Find Cross-References` (animates in a localized force graph overlay).
        4.  `Map Geography` (highlights linked locations on the GIS map).

### B. Lexicon Drawer (LD)
*   **Location**: Right edge, fixed width `320px`.
*   **Anatomy**:
    *   **Header**: Strong's code (e.g. `H7225`), Lemma (`רֵאשִׁית`), Transliteration (`re'shiyth`), Pronunciation audio trigger icon.
    *   **Definition Panel**: Full dictionary entry and semantic categories.
    *   **Occurrences Map**: List of other verses where this lemma occurs, with one-click navigation links.

### C. Bottom Tab Deck (Chronology & Maps)
*   **Mapbox/Leaflet GIS Map**:
    *   Coordinates dynamically sync with the currently active reading desk chapter.
    *   Pins are animated on entry (drop-down with spring rebound).
    *   Hovering a pin draws a dotted vector line to the verses in the chapter referencing it.
*   **Timeline Slider**:
    *   A horizontal scrub rail. Dragging the handle moves chronologically through biblical history.
    *   As the slider moves, it snaps to major event nodes (e.g., `Exodus`, `Babylonian Captivity`, `Birth of Christ`), updating the Scripture desk to the primary corresponding references automatically.

---

## 🔎 4. Command Center Overlay (Cmd+K / Ctrl+K Launcher)

Pressing `Cmd+K` or `Ctrl+K` triggers a system-wide modal launcher utilizing glassmorphic backdrop filters.

```
+-------------------------------------------------------------+
|  /search covenant                                           |
+-------------------------------------------------------------+
|  Recent Searches:                                           |
|    - Genesis 12 (Go to Chapter)                             |
|    - "tabernacle" in Exodus (FTS search)                    |
|  Tools:                                                     |
|    - Open Map Pane                                          |
|    - Look up "Abraham" (Genealogy profile)                  |
+-------------------------------------------------------------+
```

### Commands Supported:
*   `/read [ref]` (e.g., `/read Gen 1:1`) - Instantly moves the reading desk columns to the selection.
*   `/find [query]` - Performs FTS5 scriptural search.
*   `/dict [term]` - Performs Easton/Smith dictionary search.
*   `/bio [name]` - Opens biographical family relationships card.
*   `/mcp [tool]` - Dev-console command to invoke raw MCP tools.

---

## ⚡ 5. Micro-Animations & Framer Motion States

```javascript
// Sidebar Drawer Animation
export const sidebarVariants = {
  expanded: { width: 220, transition: { duration: 0.25, ease: "easeOut" } },
  collapsed: { width: 64, transition: { duration: 0.2, ease: "easeIn" } }
};

// Lexicon Drawer Slide-In
export const lexiconDrawerVariants = {
  open: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 26 } },
  closed: { x: "100%", opacity: 0, transition: { duration: 0.2 } }
};

// Page View Transitions (Router level)
export const pageVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.2 } }
};
```
