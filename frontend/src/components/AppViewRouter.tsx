import DictionaryView from "@/components/DictionaryView";
import GenealogyView from "@/components/GenealogyView";
import MapView from "@/components/MapView";
import McpView from "@/components/McpView";
import ReadingDesk from "@/components/ReadingDesk";
import SearchView from "@/components/SearchView";
import SessionsView from "@/components/SessionsView";
import SettingsView from "@/components/SettingsView";
import TimelineView from "@/components/TimelineView";

interface AppViewRouterProps {
  activeView: string;
  book: string;
  chapter: number;
  selectedVerseId: string | null;
  selectedPersonId: string | null;
  setBook: (book: string) => void;
  setChapter: (chapter: number) => void;
  setSelectedVerseId: (verseId: string | null) => void;
  setSelectedPersonId: (personId: string | null) => void;
  setActiveView: (view: string) => void;
  onNavigate: (book: string, chapter: number, verse?: number) => void;
}

export default function AppViewRouter(props: AppViewRouterProps) {
  switch (props.activeView) {
    case "search":
      return <SearchView onNavigate={props.onNavigate} onViewChange={props.setActiveView} />;
    case "dictionary":
      return <DictionaryView />;
    case "map":
      return <MapView book={props.book} chapter={props.chapter} onNavigate={props.onNavigate} />;
    case "timeline":
      return <TimelineView onNavigate={props.onNavigate} onViewChange={props.setActiveView} />;
    case "people":
      return <GenealogyView selectedPersonId={props.selectedPersonId} onSelectPerson={props.setSelectedPersonId} onNavigate={props.onNavigate} onViewChange={props.setActiveView} />;
    case "sessions":
      return <SessionsView />;
    case "mcp":
      return <McpView />;
    case "settings":
      return <SettingsView />;
    case "read":
    default:
      return <ReadingDesk book={props.book} chapter={props.chapter} setBook={props.setBook} setChapter={props.setChapter} selectedVerseId={props.selectedVerseId} setSelectedVerseId={props.setSelectedVerseId} onViewChange={props.setActiveView} />;
  }
}
