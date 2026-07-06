"use client";

import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Mark } from "@tiptap/core";
import { TextStyle } from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";
import { 
  Notebook, 
  Plus, 
  Search, 
  Trash2, 
  FileDown, 
  Save, 
  Check, 
  Loader2,
  Calendar,
  AlertCircle,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote
} from "lucide-react";
import { 
  fetchSessions, 
  createSession, 
  updateSession, 
  deleteSession, 
  searchSessions, 
  generateSessionPDF 
} from "@/lib/api";
import { readVerseDragPayload, renderVerseDropHtml } from "@/lib/verseDrop";

interface Session {
  session_id: string;
  title: string;
  content: string;
  updated_at: string;
}

const FontSize = Mark.create({
  name: 'fontSize',
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: element => element.style.fontSize,
        renderHTML: attributes => {
          if (!attributes.size) {
            return {}
          }
          return { style: `font-size: ${attributes.size}` }
        },
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'span[style*=font-size]',
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  }
});

export default function SessionsView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const titleInputRef = useRef(titleInput);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize TipTap
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontSize,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      // Trigger auto-save after 1.5 seconds of inactivity
      triggerAutoSave(editor.getHTML());
    },
    onFocus: ({ editor }) => {
      const today = new Date();
      const dateString = today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const html = editor.getHTML();
      if (!html.includes(dateString)) {
        const heading = `<h3 style="color: #2563eb; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${dateString}</h3>`;
        const cleanHtml = (html === "<p></p>" || html === "") ? "" : html;
        editor.commands.setContent(cleanHtml + heading);
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-slate focus:outline-none max-w-none h-full min-h-[400px] text-slate-800 leading-relaxed font-sans px-2",
      },
    },
  });

  const loadSessions = async () => {
    Promise.resolve().then(() => {
      setLoading(true);
    });
    try {
      const data = await fetchSessions();
      const sList = data.sessions || [];
      setSessions(sList);
      if (sList.length > 0 && !selectedSession) {
        setSelectedSession(sList[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sessions on mount
  useEffect(() => {
    Promise.resolve().then(() => {
      loadSessions();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ref in sync with titleInput state
  useEffect(() => {
    titleInputRef.current = titleInput;
  }, [titleInput]);

  // Dispatch selection changes globally
  useEffect(() => {
    if (selectedSession) {
      window.dispatchEvent(new CustomEvent("rhelo-active-session-changed", {
        detail: { sessionId: selectedSession.session_id, title: selectedSession.title }
      }));
    }
  }, [selectedSession]);

  // Synchronize selection with external updates (e.g. from StudyPane)
  useEffect(() => {
    const handleActiveSessionChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const sid = customEvent.detail.sessionId;
        if (selectedSession?.session_id !== sid) {
          const match = sessions.find((s) => s.session_id === sid);
          if (match) {
            setSelectedSession(match);
          }
        }
      }
    };
    window.addEventListener("rhelo-active-session-changed", handleActiveSessionChanged);
    return () => window.removeEventListener("rhelo-active-session-changed", handleActiveSessionChanged);
  }, [sessions, selectedSession]);

  // Update editor content when active session changes
  useEffect(() => {
    if (selectedSession && editor) {
      editor.commands.setContent(selectedSession.content || "");
      Promise.resolve().then(() => {
        setTitleInput(selectedSession.title);
        titleInputRef.current = selectedSession.title;
      });
    }
  }, [selectedSession, editor]);

  // Handle local session search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        setLoading(true);
        searchSessions(searchQuery)
          .then((data) => setSessions(data.sessions || []))
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        loadSessions();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleCreateSession = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const dateString = today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const initialContent = `<h3 style="color: #2563eb; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${dateString}</h3><p></p>`;
      const res = await createSession("Untitled Study Session", initialContent);
      const newSession = {
        session_id: res.session_id,
        title: res.title,
        content: res.content,
        updated_at: new Date().toISOString()
      };
      setSessions((prev) => [newSession, ...prev]);
      setSelectedSession(newSession);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async () => {
    if (!selectedSession || !editor) return;
    setSaving(true);
    try {
      const htmlContent = editor.getHTML();
      await updateSession(selectedSession.session_id, titleInput, htmlContent);
      
      // Update local state lists
      setSessions((prev) => 
        prev.map((s) => 
          s.session_id === selectedSession.session_id 
            ? { ...s, title: titleInput, content: htmlContent, updated_at: new Date().toISOString() } 
            : s
        )
      );
      
      // Flash save state
      setTimeout(() => setSaving(false), 500);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const triggerAutoSave = (htmlContent: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      if (!selectedSession) return;
      try {
        const currentTitle = titleInputRef.current;
        await updateSession(selectedSession.session_id, currentTitle, htmlContent);
        setSessions((prev) => 
          prev.map((s) => 
            s.session_id === selectedSession.session_id 
              ? { ...s, title: currentTitle, content: htmlContent, updated_at: new Date().toISOString() } 
              : s
          )
        );
      } catch (err) {
        console.error("Auto-save failed", err);
      }
    }, 1500);
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this study session?")) return;
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
      if (selectedSession?.session_id === id) {
        setSelectedSession(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedSession || !editor) return;
    setExporting(true);
    setExportUrl(null);
    try {
      const htmlContent = editor.getHTML();
      const res = await generateSessionPDF(selectedSession.session_id, titleInput, htmlContent);
      if (res.status === "success" && res.pdf_url) {
        // Since we are running in local source dev mode, prepend the server host
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5050";
        const fullUrl = `${apiBase}${res.pdf_url}`;
        setExportUrl(fullUrl);
        
        // Use a hidden anchor element with 'download' attribute to trigger WebView save dialog
        const link = document.createElement("a");
        link.href = fullUrl;
        link.download = `${titleInput || "session"}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleDropVerse = (e: React.DragEvent) => {
    e.preventDefault();
    const versePayload = readVerseDragPayload(e.dataTransfer);
    
    if (editor) {
      // Ensure date header exists
      const today = new Date();
      const dateString = today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const html = editor.getHTML();
      if (!html.includes(dateString)) {
        const heading = `<h3 style="color: #2563eb; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${dateString}</h3>`;
        const cleanHtml = (html === "<p></p>" || html === "") ? "" : html;
        editor.commands.setContent(cleanHtml + heading);
      }

      if (versePayload) {
        editor.commands.insertContent(renderVerseDropHtml(versePayload));
        triggerAutoSave(editor.getHTML());
      }
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      {/* Left Sidebar List Pane */}
      <div className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Notebook size={20} className="text-blue-600" />
            <h3 className="font-bold text-base text-slate-900 font-sans">
              Study Sessions
            </h3>
          </div>
          <button
            onClick={handleCreateSession}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors border border-slate-200/50"
            title="Create new session"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Search filter */}
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search session content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
            />
          </div>
        </div>

        {/* Sessions scrollable list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading && sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-500 text-sm">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <span>Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20 px-5 text-sm text-slate-400 font-sans flex flex-col items-center justify-center gap-3">
              <Notebook size={24} className="text-slate-300" />
              <p className="font-semibold text-slate-700">No sessions found</p>
              <p className="text-xs text-slate-500 max-w-[180px] leading-relaxed">Create a session using the plus button to record your study logs.</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isSelected = selectedSession?.session_id === s.session_id;
              const formattedDate = new Date(s.updated_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              });
              return (
                <div
                  key={s.session_id}
                  onClick={() => setSelectedSession(s)}
                  className="w-full text-left p-3.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer border border-transparent hover:border-slate-200 group/item font-sans"
                  style={{
                    background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent",
                    borderColor: isSelected ? "rgba(37, 99, 235, 0.2)" : "transparent",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate group-hover/item:text-blue-600 transition-colors font-sans">
                      {s.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5 font-sans">
                      <Calendar size={11} />
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(s.session_id, e)}
                    className="opacity-0 group-hover/item:opacity-100 p-1 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-400 transition-all cursor-pointer"
                    title="Delete session"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Pane Editor Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedSession ? (
          <>
            {/* Editor Action Header */}
            <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/30">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => {
                  setTitleInput(e.target.value);
                  titleInputRef.current = e.target.value;
                  if (editor) triggerAutoSave(editor.getHTML());
                }}
                className="font-bold text-lg text-slate-800 border-none outline-none bg-transparent focus:ring-0 w-2/3 font-sans"
                placeholder="Session Title"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleManualSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold cursor-pointer transition-colors font-sans"
                >
                  {saving ? (
                    <>
                      <Check size={14} className="text-green-500" />
                      <span className="text-green-600">Saved</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Save</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold cursor-pointer transition-colors shadow-xs font-sans"
                >
                  {exporting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Compiling...</span>
                    </>
                  ) : (
                    <>
                      <FileDown size={14} />
                      <span>PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Formatting Toolbar */}
            <div className="border-b border-slate-200 bg-slate-50/50 p-2 flex flex-wrap items-center gap-1 shrink-0 select-none">
              {/* Undo / Redo */}
              <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1.5">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().undo().run()}
                  disabled={!editor?.can().undo()}
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-600 disabled:opacity-30 cursor-pointer transition-colors"
                  title="Undo"
                >
                  <Undo2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().redo().run()}
                  disabled={!editor?.can().redo()}
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-600 disabled:opacity-30 cursor-pointer transition-colors"
                  title="Redo"
                >
                  <Redo2 size={16} />
                </button>
              </div>

              {/* Headings & Text Styles */}
              <div className="flex items-center gap-1 border-r border-slate-200 pr-1.5 mr-1.5">
                <select
                  value={
                    editor?.isActive('heading', { level: 1 }) ? 'h1' :
                    editor?.isActive('heading', { level: 2 }) ? 'h2' :
                    editor?.isActive('heading', { level: 3 }) ? 'h3' : 'p'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'p') editor?.chain().focus().setParagraph().run();
                    else if (val === 'h1') editor?.chain().focus().toggleHeading({ level: 1 }).run();
                    else if (val === 'h2') editor?.chain().focus().toggleHeading({ level: 2 }).run();
                    else if (val === 'h3') editor?.chain().focus().toggleHeading({ level: 3 }).run();
                  }}
                  className="text-xs border border-slate-200 bg-white rounded-md px-2 py-1.5 outline-none text-slate-800 font-sans cursor-pointer hover:border-slate-350 transition-colors font-medium"
                >
                  <option value="p">Normal Text</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                </select>
              </div>

              {/* Font Size Selector */}
              <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1.5">
                <select
                  value={editor?.getAttributes('fontSize').size || '16px'}
                  onChange={(e) => {
                    const size = e.target.value;
                    if (size === 'default') {
                      editor?.chain().focus().unsetMark('fontSize').run();
                    } else {
                      editor?.chain().focus().setMark('fontSize', { size }).run();
                    }
                  }}
                  className="text-xs border border-slate-200 bg-white rounded-md px-2 py-1.5 outline-none text-slate-800 font-sans cursor-pointer hover:border-slate-350 transition-colors font-medium"
                >
                  <option value="12px">12px</option>
                  <option value="14px">14px</option>
                  <option value="16px">16px (Default)</option>
                  <option value="18px">18px</option>
                  <option value="20px">20px</option>
                  <option value="24px">24px</option>
                  <option value="30px">30px</option>
                  <option value="36px">36px</option>
                  <option value="48px">48px</option>
                </select>

                {/* Font Size Increase / Decrease Buttons */}
                <button
                  type="button"
                  onClick={() => {
                    const current = editor?.getAttributes('fontSize').size || '16px';
                    const num = parseInt(current, 10) || 16;
                    const next = Math.min(72, num + 2);
                    editor?.chain().focus().setMark('fontSize', { size: `${next}px` }).run();
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                  title="Increase Font Size"
                >
                  A<sup>+</sup>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current = editor?.getAttributes('fontSize').size || '16px';
                    const num = parseInt(current, 10) || 16;
                    const next = Math.max(8, num - 2);
                    editor?.chain().focus().setMark('fontSize', { size: `${next}px` }).run();
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                  title="Decrease Font Size"
                >
                  A<sup>-</sup>
                </button>
              </div>

              {/* Bold, Italic, Underline, Strikethrough */}
              <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1.5">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive('bold') ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Bold"
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive('italic') ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Italic"
                >
                  <Italic size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive('underline') ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Underline"
                >
                  <UnderlineIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive('strike') ? 'bg-blue-100 text-blue-700 font-bold' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Strikethrough"
                >
                  <Strikethrough size={15} />
                </button>
              </div>

              {/* Text Alignments */}
              <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1.5">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Align Left"
                >
                  <AlignLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Align Center"
                >
                  <AlignCenter size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Align Right"
                >
                  <AlignRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive({ textAlign: 'justify' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Align Justify"
                >
                  <AlignJustify size={15} />
                </button>
              </div>

              {/* Lists */}
              <div className="flex items-center gap-0.5 border-r border-slate-200 pr-1.5 mr-1.5">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Bullet List"
                >
                  <List size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Numbered List"
                >
                  <ListOrdered size={15} />
                </button>
              </div>

              {/* Blockquote */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    editor?.isActive('blockquote') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/60 text-slate-600'
                  }`}
                  title="Blockquote"
                >
                  <Quote size={15} />
                </button>
              </div>
            </div>

            {/* Hint Dropzone Area */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropVerse}
              className="flex-1 overflow-y-auto p-8 relative group"
            >
              <EditorContent editor={editor} className="h-full" />
            </div>

            {exportUrl && (
              <div className="px-6 py-2 border-t border-slate-100 bg-blue-50/50 flex items-center justify-between text-xs text-blue-700 font-sans">
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={13} />
                  <span>PDF Document Compiled Successfully! If download didn&apos;t trigger, click right button to open.</span>
                </div>
                <a href={exportUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-blue-900">
                  Open PDF
                </a>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-sans gap-3">
            <Notebook size={40} className="text-slate-300 animate-pulse" />
            <p className="font-semibold text-slate-700 text-lg">No session selected</p>
            <p className="text-sm text-slate-500 max-w-[280px] text-center leading-relaxed font-sans">Select a study session from the sidebar or create a new one to begin taking structured exegesis logs.</p>
          </div>
        )}
      </div>
    </div>
  );
}
