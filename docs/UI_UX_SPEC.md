# Rhelo interface specification

This document describes the interface implemented in `frontend/src`, not a future mockup. The same statically exported React application runs in a browser, behind the Docker Nginx image, and inside Tauri.

## Visual system

Rhelo uses a restrained light workspace: slate surfaces and borders, white content panes, royal-blue active states, sky/indigo secondary accents, and compact rounded controls. Tokens live in `src/app/globals.css`.

| Token | Current value/use |
|---|---|
| `--bg-base` | `#f8fafc`, application background |
| `--bg-surface` | `#ffffff`, cards and panes |
| `--border-subtle` | `#e2e8f0`, divisions and inactive borders |
| `--primary` | `#2563eb`, selected navigation/actions |
| `--primary-hover` | `#1d4ed8`, active hover |
| `--secondary` | `#0ea5e9`, secondary emphasis |
| `--accent` | `#4f46e5`, lexical/indigo accents |
| `--text-primary` | `#0f172a`, headings |
| `--text-muted` | `#64748b`, metadata |

Interface typography uses the system stack headed by Avenir Next/Segoe UI. Reading prose uses Inter/Noto Sans when installed and falls back to system fonts. No web font download is required. Source-language runs use script-appropriate browser/system fallbacks and Hebrew is rendered right-to-left where applicable.

## Application frame and navigation

The application fills the viewport and prevents body scrolling; each view manages its own scroll region. The left sidebar is 72 px collapsed and expands to 240 px on hover. It contains:

1. Read
2. Search
3. Maps
4. Timeline
5. People
6. Dictionary
7. Sessions
8. MCP
9. Settings, pinned to the bottom

The Rhelo logo and label appear at the top. Active views use a blue-tinted background and a blue left indicator. `AppViewRouter.tsx` is the single mapping between navigation IDs and feature views.

`Cmd+K` on macOS or `Ctrl+K` elsewhere opens the command center. It supports quick navigation/search patterns for reading, finding scripture, dictionary terms, and biographies.

## Book, chapter, and English edition modal

`BookChapterPickerModal.tsx` is shared by reading and mapping contexts. It is a centered, scrollable modal over a dimmed backdrop and has two top tabs:

- **Book & chapter** shows Old and New Testament book grids. Selecting a book opens its exact chapter grid; selecting a chapter applies the choice and closes the modal.
- **Translation** lists Berean Standard Bible, World English Bible, and King James Version as full-name cards with descriptions and a selected check state.

The edition choice is global and persisted locally. It updates English content in Read, Search, verse study, map/route cards, cross-references, and lexicon occurrences without changing enabled Indic columns.

## Read workspace

`ReadingDesk.tsx` provides chapter navigation, book/chapter selection, font sizing, translation-column controls, and a verse-by-verse aligned grid.

- English is labeled with the active edition name.
- Hebrew/Greek, Hindi, Telugu, Malayalam, and Tamil columns can be enabled independently.
- Clicking source-language words opens lexical details; morphology and normalized-script matching synchronize word emphasis across columns where data permits.
- A selected verse opens the study drawer with verse context, lexicon, commentary, geography, chronology, cross-references, and session tools.
- Individual verses are draggable. The payload contains each visible translation separately rather than concatenating display text.
- English and Hebrew/Greek show TTS controls. Hindi, Telugu, Malayalam, and Tamil intentionally do not.
- Chapter playback is available only for currently enabled speakable columns.

## Structured drag and drop

Research items from Read, Search, Maps, Timeline, Dictionary, and the study pane dispatch `rhelo-drag-start`/`rhelo-drag-end` events. While dragging, a floating target appears near the lower-right corner and can append the item to a selected/recent session.

Scripture drag payloads use `application/json-verses`. `src/lib/verseDrop.ts` renders the reference and each translation as its own paragraph, so English, Hebrew/Greek, and every enabled Indic language remain on separate lines in the session editor. Plain-text drag data remains as a compatibility fallback for other cards.

## Search and study pane

`SearchView.tsx` combines scripture FTS results with a persistent `StudyPane`.

- Results use the active English edition.
- Optional book and testament filters are derived from the unfiltered match set.
- Results can sort by FTS relevance or canonical scripture order and paginate at 50 per page by default.
- Selecting a result loads its context; navigation jumps back to the precise reading location.

`StudyPane.tsx` has Verse, Lexicon, and Sessions tabs. It centralizes selected-verse material, source-word definitions/occurrences, draggable commentary, cross-reference, and chronological-event cards, session switching, and quick note appending. Research sections use compact heading arrows so commentary, references, locations, events, definitions, and occurrences can be expanded or collapsed independently.

## Maps, timeline, and people

- **Maps** uses a Leaflet canvas with a chapter-atlas tab and biblical-routes tab. Place/route cards include active-edition English and original text where linked, and may include name meaning, commentary, and dictionary material.
- **Timeline** presents events in chronological order, with a visual track, selected-event detail, linked scripture references, and draggable event cards.
- **People** searches the local people dataset and renders profile/name information plus an interactive SVG relationship graph. The canvas supports pan/zoom-like interaction and direct navigation from verse references.

## Dictionary workspace

`DictionaryView.tsx` searches three local indexes in one screen: Strong's lexicon, the combined Easton's/Smith's dictionary, and Nave's topics. Cards are draggable into sessions. Dictionary speech uses the shared browser/Tauri speech bridge and therefore follows the English-only portion of the TTS policy.

## Sessions workspace

`SessionsView.tsx` is a two-pane local note environment:

- The left pane creates, selects, deletes, and FTS-filters sessions.
- The right pane uses TipTap rich text with headings, font sizing, emphasis, alignment, lists, quotes, undo, and redo.
- Content auto-saves after 1.5 seconds of inactivity.
- Dropped multilingual verses retain one paragraph per language.
- PDF export posts the HTML to the Python backend, which writes a ReportLab document beside the active database and returns a download path.

The global microphone records in Tauri through Whisper or falls back to browser `SpeechRecognition` when available. Transcribed text is shown in a review dialog, then appended to a chosen session with a date header and timestamp. Recording never bypasses the review step.

## MCP and settings

The MCP page documents the native architecture and reserves a home for a future Rust-native MCP transport. Rhelo does not launch an HTTP companion or Python sidecar.

Settings displays database-backed content counts, data/source attribution, and the active Rhelo color system. It is informational; English edition selection lives in the shared scripture modal.

## Responsive and accessibility behavior

- Feature grids collapse at Tailwind breakpoints, and the scripture modal changes from two to three columns for books and five to seven for chapters.
- Buttons use native elements, labels/titles, focusable controls, and selected tab semantics in the modal.
- Hebrew direction and source-script sizing are handled separately from Latin/Indic prose.
- Motion is short and functional: sidebar expansion, modal entry, active indicators, and drag/listening feedback.

Known limitation: the experience is optimized for desktop-sized workspaces. Mobile layout is partially responsive but dense research views and the hover-expanding sidebar need a dedicated touch-navigation design before calling the web UI fully mobile-ready.
