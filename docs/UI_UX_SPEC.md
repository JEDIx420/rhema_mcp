# Rhema UI/UX Specification & Design System Manual

This document serves as the comprehensive design and interactive behavior manual for building the Rhema front-end application (Next.js / Tauri / Docker Web).

---

## 🎨 1. Design System & Style Tokens (zenrev aesthetics)

### CSS Variables & HSL Theme (Sleek High-Contrast Light/Soft Base)
```css
:root {
  /* HSL Tailored Palettes - Sleek Command Center White/Slate Light Mode Base */
  --bg-base: #f8fafc;                   /* Slate-50 background */
  --bg-surface: #ffffff;               /* Crisp pure white for cards, sidebars, panes */
  --bg-surface-elevated: #ffffff;      /* Modal popovers, hover cards */
  
  --border-subtle: #e2e8f0;            /* Slate-200 dividers and borders */
  --border-hover: #cbd5e1;             /* Slate-300 active hover borders */
  --border-focus: rgba(37, 99, 235, 0.5); /* Royal Blue focus glow */
  
  --primary: #2563eb;                  /* Royal Blue - Active states, highlight borders */
  --primary-hover: #1d4ed8;            /* Deep Blue */
  --secondary: #0ea5e9;                /* Sky Blue - secondary buttons, location badges */
  --accent: #7c3aed;                   /* Purple - Lexicon codes, Strong's indexes */
  
  --text-primary: #0f172a;             /* Slate-900 for high-readability headings */
  --text-secondary: #334155;           /* Slate-700 for main prose and body text */
  --text-muted: #64748b;               /* Slate-500 for captions, labels, subtitles */
  
  /* Glassmorphism settings */
  --glass-blur: blur(16px);
  --glass-opacity: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(15, 23, 42, 0.06);
}
```

### Typography Settings
*   **Interface Controls**: `font-family: var(--font-outfit), sans-serif;` (weights: 400 Medium, 600 SemiBold, 800 ExtraBold). Used for headings, nav items, and action buttons.
*   **Scripture Columns**: `font-family: var(--font-inter), sans-serif;` (weights: 400 Regular, 500 Medium). Default base size starts at `17px` with a line-height of `1.75` for high-density, comfortable reading.
*   **Hebrew/Greek scripts**: `font-family: 'SBL Hebrew', 'SBL Greek', 'Noto Serif Hebrew', serif;` with appropriate right-to-left direction properties for WLC Hebrew text.

---

## 🖥️ 2. Screen Anatomy & Layout Framework

The application is structured into a persistent sidebar navigation and a primary dynamic workspace main panel.

```
+---------------------------------------------------------------------------------------------------------------+
| [SB]   |  [Reading Desk Top Bar: Prev/Next Chapter | Book Chapter Selector Modal Button | Translation Pills]  |
| H-16   |------------------------------------------------------------------------------------------------------|
| logo   |  [Interlinear Reading Desk - Verses Columns]                                                         |
| ------ |  +-------------------------+-------------------------+-------------------------+---------------------+
| [Read] |  | Column 1: English (KJV)  | Column 2: Original Grk  | Column 3: Hindi         | Col 4: Malayalam    |
| [Srch] |  | [GEN.1.1] In the        | [GEN.1.1] בְּרֵאשִׁ֖ית  | आदि में परमेश्वर ने     | ആദിയിൽ ദൈവം ആകാശവും |
| [Maps] |  | beginning...            | בָּרָ֣א אֱלֹהִ֑ים...     |                         |                     |
| [Time] |  +-------------------------+-------------------------+-------------------------+---------------------+
| [Peop] |  [Exegesis Slide-out Drawer: Selected Verse Details | Commentary Paragraphs | Cross-References]      |
| [Dict] |                                                                                                      |
+--------+------------------------------------------------------------------------------------------------------+
```

### Screen 1: Persistent Sidebar (SB)
*   **Visual Behavior**: Uses Framer Motion to animate dynamically between a collapsed width of `64px` and an expanded width of `220px` when hovered.
*   **Spacings & Alignment**:
    *   **Collapsed State**: Icons are perfectly centered (`justify-center px-0 py-3`) within the `64px` column to eliminate off-center alignment.
    *   **Expanded State**: Icons align left alongside text labels (`justify-start px-3.5 gap-3.5 py-3`) for a structured look.
*   **Buttons (Top to Bottom)**:
    1.  `Brand Header`: Shows logo pill `rh` and title `Rhema` strictly aligned to the 64px/h-16 header line.
    2.  `Read`: Navigates to interlinear Scripture reading columns.
    3.  `Search`: Accesses Scripture full-text keyword indexing pane.
    4.  `Maps`: Opens GIS ancient geography location visualizer.
    5.  `Timeline`: Traces historical events with visual chronological scrollers.
    6.  `People`: Focuses on biographical relationships and SVG pedigree tree maps.
    7.  `Dictionary`: Combined Easton's, Smith's, Hitchcock's, and Nave's topical search desks.
    8.  `Settings`: Aligned to the bottom footer; manages servers and translation states.

---

## 📖 3. Detailed Page-by-Page Components

### A. The Interlinear Reading Desk (`ReadingDesk.tsx`)
The primary interlinear alignment station, displaying scriptures in side-by-side translation columns:
1.  **Top Header Bar**:
    *   `Prev/Next Chapter Buttons`: Chevron left/right arrows that dynamically transition between books using exact chapter counts and disable boundaries on Genesis 1 and Revelation 22.
    *   `Book Selector Button`: Displays `[BookName] [ChapterNumber]` (e.g. *Genesis 1*) as a clickable pill button with `BookOpen` and `ChevronDown` icons. Triggers the [BookChapterPickerModal](file:///Users/vincyvincent/rhema_mcp/frontend/src/components/BookChapterPickerModal.tsx).
    *   `Text Sizer Widget`: Offers `-` / `+` font scaling options. Default sizing initialized at `17px` for enhanced legibility.
    *   `Translation Pills`: Staggered flex buttons (`gap-2.5`) corresponding to English, Original (Hebrew/Greek), Hindi, Telugu, Malayalam, and Tamil translations. Active states show as solid blue text with a soft blue backdrop (`rgba(37, 99, 235, 0.08)`).
2.  **Verses Pane**:
    *   `Multilingual Columns Grid`: Dynamically fits columns based on the enabled translations count.
    *   `Bidirectional Highlights (Vowel-Tolerant)`: Clicking or hovering over an English word automatically highlights the corresponding Hebrew/Greek word in the Original column. Employs a custom consonantal root extraction algorithm (`stripVowels()`) to bypass spelling differences and grammatical prefixes (`w`, `h`, `b`, `l`, `k`, `m`), yielding instant matching.
    *   `Original Lexicon Click Modal`: Clicking an original Hebrew or Greek word opens a detailed popover modal containing Strongs ID, Lemma, and phonetic pronunciation guide (e.g., *Pronunciation: tehom*), plus un-truncated definitions in a scrollable card.
3.  **Exegesis Drawer (Right Panel)**:
    *   Slides out on verse select. Integrates the unified `<StudyPane />` component, exposing Lexicon, Commentary, Geography maps, timelines, and cross-references. Features full verse occurrences navigation which redirects the main Reading Desk chapter coordinates and syncs view coordinates automatically.

---

### B. Book & Chapter Picker Modal (`BookChapterPickerModal.tsx`)
A centered, focus-stealing overlay replacing cramped inline dropdown menus:
*   **Modal Overlay**: Features a semi-transparent slate backdrop (`bg-slate-900/40`) with high-fidelity blur (`backdrop-blur-xs`) and an absolute depth of `z-[9999]` to render above external Leaflet GIS map panes.
*   **Book Picker Screen**: Displays Old Testament and New Testament books segmented in a responsive 4-column grid. Currently active books show a soft blue highlight border.
*   **Chapter Selector Screen**: Clicking any book transitions the modal into a grid of chapters (e.g., chapters 1-50 for Genesis) using exact scripture counts. Features a `ChevronLeft` back trigger to return to the book grid.

---

### C. GIS Geography Map View (`MapView.tsx`)
An interactive geographical interface displaying historical places mentioned in scripture:
*   **Context Tabs**: Added toggle tabs at the top of the sidebar control:
    *   `Chapter Atlas`: Displays geocoded places mapped to the current reading context.
    *   `Biblical Routes`: Allows selecting sequential historical routes (e.g. Abraham's Journey, the Exodus Journey, or Paul's Missionary Travels).
*   **Sidebar Control**: Features a clickable header banner: `Current Context: [Book] [Chapter]`. Clicking the banner opens the `BookChapterPickerModal`, enabling direct chapter navigation within the Maps view.
*   **Places List Panel**: Enumerates all geocoded places mapped to the current chapter/route. Hovering/clicking a place name auto-centers the Leaflet map onto its coordinates.
*   **Leaflet Map Canvas & Journey Paths**:
    *   Features a full-screen geographical layer. Mapped pins drop into coordinates with dynamic spring animations. Floating tooltips render corresponding verse references on hover.
    *   When a route is active, a sequential path is drawn connecting journey points using a custom `var(--primary)` dashed stroke polyline (`<Polyline>`) that matches the zenrev command center aesthetic.

---

### D. Chronological Timeline View (`TimelineView.tsx`)
A visual historical dashboard charting events across scripture:
*   **Horizontal Visual Track**: A scrollable horizontal track representing timeline events. Each event displays as a visual circular dot connected by a continuous horizontal rule.
*   **Milestone Bubbles**: Displays floating, colored year tags (e.g. *2000 BC*) above event nodes, and event titles and locations below.
*   **2-Column Lower Dashboard**:
    *   **Left Details Column (60% width)**: Renders a card displaying the selected event's title, location, narrative description, and a flex list of clickable scripture references. Clicking any reference navigates the user back to the Reading Desk at that verse.
    *   **Right Chronology Checklist (40% width)**: A scrollable, vertical list of all events sorted chronologically, serving as an index to quickly select and focus milestones.

---

### E. Genealogical Lineage View (`GenealogyView.tsx`)
Renders interactive biographical relationship nodes:
*   **Left Sidebar Biography**: Features a prominent input box to search characters (e.g. *David*). Displays name meanings, gender (fixed mapping check resolving startsWith("m") to *Male* and startsWith("f") to *Female*), tribal lineages, attributes, and biography notes.
*   **Right SVG Graph Canvas**: Renders family trees in a `viewBox="0 0 600 500"` layout.
*   **Spouses**: Staggered vertically on alternating offsets to prevent collision with children.
*   **Children**: Arranged along a bottom row using a dynamic step-width calculation (`Math.min(110, 480 / (count - 1))`) that fits all children on-screen without canvas overflows.

---

### F. Search Scriptures View (`SearchView.tsx`)
A dual-pane research center integrating fast queries and instant exegesis:
*   **Split-Pane Grid**: Spans the full screen width using a `grid grid-cols-1 md:grid-cols-12` layout.
*   **Left Column (Search & Results - col-span-5)**: 
    *   **Header Box**: Centers the search input bar inside a prominent card container with dropshadows.
    *   **Filter Row**: Provides sorting (Relevance / Chronological) and dynamic Book and Testament dropdown filters. These dropdown options query the backend matches list and automatically constrain themselves to only list books and testaments containing results matching the query context.
    *   **Results Panel**: Scrollable search list displaying paginated matching cards (50 per page). Clicking a card selects the verse. Clicking the navigation arrow jumps the user directly to that verse in the Reading Desk.
*   **Right Column (Study Pane - col-span-7)**: Embeds the unified `<StudyPane />` component, loading the selected search result details immediately for context-rich study without losing search results.

---

### G. Interactive "Sessions" Note Workspace (`SessionsView.tsx`)
A split-pane research note manager integrating rich text composition, voice transcribing, and drag-and-drop scripture quoting:
*   **Left Panel (Sessions Browser)**: Lists saved study logs displaying titles and formatted modification timestamps, filtered in real-time by a search input using FTS5 virtual indexing, with an option to create new sessions.
*   **Right Panel (TipTap Editor)**: Renders a spacious rich-text canvas using TipTap styled with custom typography, auto-saving modifications to the database after 1.5s of inactivity.
*   **Compile to PDF Action**: Exports note documents to beautiful PDFs compiled by ReportLab flowables, downloading the file automatically.
*   **Drag-to-Save Dropzone**: Verses from the Reading Desk can be dragged directly into the editor pane, rendering a custom-styled quote block.

---

### H. Multi-State Floating Overlays & Workspace Router (`page.tsx`)
Global overlays positioned with absolute layouts over the viewports:
*   **Magnetic Drop Zone**: During verse dragging, a glassmorphic target appears in the bottom right corner. Dropping the verse here immediately appends a blockquote to the latest study session.
*   **Listening Pill Waveform**: During STT microphone recording, a dark glassmorphic badge appears in the top corner featuring a looping height-animated audio waveform.
*   **Floating Mic Button**: A floating circle button in the bottom right corner of the screen toggles STT speech dictation start/stop.

---

### I. Command Center Launcher (`CommandCenter.tsx`)
*   **Input Trigger**: Activated via `Cmd+K` or `Ctrl+K` globally.
*   **Backdrop**: Backdrop blur overlay spanning the whole viewport.
*   **Syntax Actions**: Matches `/read [ref]`, `/find [keyword]`, `/dict [term]`, and `/bio [person]` inputs to instantly trigger corresponding state transitions in the main views.

