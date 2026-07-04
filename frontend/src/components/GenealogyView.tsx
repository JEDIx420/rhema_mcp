"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Compass as CompassIcon, Search as SearchIcon, Users as UsersIcon, Loader2 as LoaderIcon, ChevronRight as ChevronRightIcon } from "lucide-react";
import { fetchBiography } from "@/lib/api";
import { getBookName } from "@/lib/books";

interface BioProfile {
  id: string;
  name: string;
  sex: string;
  tribe: string | null;
  unique_attribute: string | null;
  notes: string | null;
}

interface Relationship {
  relationship_type: string;
  relation_name: string;
  relation_id: string;
  relation_sex?: string;
  verse_id: string | null;
}

export default function GenealogyView({
  selectedPersonId,
  onSelectPerson,
  onNavigate,
  onViewChange,
}: {
  selectedPersonId: string | null;
  onSelectPerson: (personId: string) => void;
  onNavigate: (book: string, chapter: number, verse?: number) => void;
  onViewChange: (view: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentId, setCurrentId] = useState<string>("Adam_1");
  const [profile, setProfile] = useState<BioProfile | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [nameMeaning, setNameMeaning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with global selection
  useEffect(() => {
    if (selectedPersonId) {
      setCurrentId(selectedPersonId);
    }
  }, [selectedPersonId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchBiography(currentId)
      .then((data) => {
        if (!active) return;
        if (data.error) {
          setError(data.error);
          setProfile(null);
          setRelationships([]);
          setNameMeaning(null);
        } else {
          setProfile(data.profile);
          setRelationships(data.relationships || []);
          setNameMeaning(data.name_meaning);
        }
      })
      .catch(() => {
        if (active) setError("Could not find biographical details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setCurrentId(searchQuery.trim());
    }
  };

  // SVG Family Tree Layout computation
  const treeLayout = useMemo(() => {
    if (!profile) return { nodes: [], connections: [], viewBoxWidth: 600 };

    const nodes: any[] = [];
    const connections: any[] = [];

    // Parse relations
    const fathers = relationships.filter(
      (r) =>
        (r.relationship_type === "son" || r.relationship_type === "daughter" || r.relationship_type === "creation") &&
        r.relation_sex === "male"
    );
    const mothers = relationships.filter(
      (r) =>
        (r.relationship_type === "son" || r.relationship_type === "daughter" || r.relationship_type === "creation") &&
        r.relation_sex === "female"
    );
    const spouses = relationships.filter(
      (r) => r.relationship_type === "wife" || r.relationship_type === "husband" || r.relationship_type === "concubine"
    );
    const children = relationships.filter(
      (r) =>
        r.relationship_type === "father" ||
        r.relationship_type === "mother" ||
        r.relationship_type === "Creator"
    );

    // Spacing calculation to prevent children overlap
    const childrenCount = children.length;
    const stepX = 110; // 110px spacing ensures no horizontal overlap
    const totalChildrenWidth = Math.max(0, (childrenCount - 1) * stepX);
    const viewBoxWidth = Math.max(600, totalChildrenWidth + 140); // 70px padding on each side
    const centerX = viewBoxWidth / 2;
    const centerY = 200;

    // Add Central Node
    nodes.push({
      id: profile.id,
      name: profile.name,
      x: centerX,
      y: centerY,
      role: "center",
      sex: profile.sex?.toLowerCase().startsWith("m") ? "M" : "F",
    });

    // 1. Father (Top Left)
    if (fathers.length > 0) {
      const f = fathers[0];
      const fx = centerX - 110;
      const fy = centerY - 100;
      nodes.push({ id: f.relation_id, name: f.relation_name, x: fx, y: fy, role: "father", sex: "M" });
      connections.push({ x1: fx + 45, y1: fy + 15, x2: centerX - 20, y2: centerY - 15 });
    }

    // 2. Mother (Top Right)
    if (mothers.length > 0) {
      const m = mothers[0];
      const mx = centerX + 110;
      const my = centerY - 100;
      nodes.push({ id: m.relation_id, name: m.relation_name, x: mx, y: my, role: "mother", sex: "F" });
      connections.push({ x1: mx - 45, y1: my + 15, x2: centerX + 20, y2: centerY - 15 });
    }

    // 3. Spouses (Right side - staggered)
    spouses.forEach((s, idx) => {
      const sx = centerX + 145;
      const offsetMultiplier = Math.floor((idx + 1) / 2) * (idx % 2 === 0 ? 1 : -1);
      const sy = centerY + offsetMultiplier * 40;
      
      nodes.push({ id: s.relation_id, name: s.relation_name, x: sx, y: sy, role: "spouse", sex: s.relation_sex?.toLowerCase().startsWith("f") ? "F" : "M" });
      connections.push({ x1: centerX + 45, y1: centerY, x2: sx - 45, y2: sy, isDouble: true });
    });

    // 4. Children (Bottom Row - dynamically spaced)
    if (childrenCount > 0) {
      const startX = centerX - ((childrenCount - 1) * stepX) / 2;
      
      children.forEach((c, idx) => {
        const cx = startX + idx * stepX;
        const cy = centerY + 120;
        nodes.push({ id: c.relation_id, name: c.relation_name, x: cx, y: cy, role: "child", sex: c.relation_sex?.toLowerCase().startsWith("m") ? "M" : "F" });
        
        // Draw branched connections cleanly
        connections.push({ x1: centerX, y1: centerY + 15, x2: centerX, y2: centerY + 65 });
        connections.push({ x1: centerX, y1: centerY + 65, x2: cx, y2: centerY + 65 });
        connections.push({ x1: cx, y1: centerY + 65, x2: cx, y2: cy - 15 });
      });
    }

    return { nodes, connections, viewBoxWidth };
  }, [profile, relationships]);

  const handleNavigateVerse = (verseId: string) => {
    const parts = verseId.split(".");
    onNavigate(parts[0], parseInt(parts[1]), parseInt(parts[2] || "1"));
    onViewChange("read");
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      {/* Bio Information Sidebar */}
      <div className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white">
        <div className="h-16 px-4 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <UsersIcon size={18} className="text-blue-600" />
          <h3 className="font-bold text-sm font-sans text-slate-900">
            Geneacological Profiles
          </h3>
        </div>

        {/* Profile Search */}
        <form onSubmit={handleSearchSubmit} className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative flex items-center bg-white rounded-lg shadow-xs border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
            <SearchIcon size={14} className="absolute left-3 pointer-events-none text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search (e.g. David_1)"
              className="w-full pl-9 pr-3 py-2 text-xs bg-transparent border-none outline-none text-slate-900 placeholder-slate-400 rounded-lg font-sans"
            />
          </div>
        </form>

        {/* Biography Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500 text-xs">
              <LoaderIcon className="animate-spin text-blue-500" size={20} />
              <span>Loading profile...</span>
            </div>
          ) : error || !profile ? (
            <div className="text-xs text-center py-10 text-slate-500 italic font-sans">
              {error || "Select a person to view family relationships."}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Structured White Details Card */}
              <div className="rounded-xl border border-slate-200 p-5 bg-white shadow-xs space-y-4">
                <div>
                  <h4 className="text-xl font-bold font-sans text-slate-900">{profile.name}</h4>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">ID: {profile.id}</div>
                </div>

                {nameMeaning && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs leading-normal">
                    <div className="font-semibold text-[10px] uppercase text-slate-500 mb-0.5 font-sans">Hitchcock Name Meaning</div>
                    <span className="italic text-slate-700 font-serif">&ldquo;{nameMeaning}&rdquo;</span>
                  </div>
                )}

                <div className="space-y-2.5 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-500 font-sans">Gender: </span>
                    <span className="font-semibold text-slate-700">
                      {profile.sex?.toLowerCase().startsWith("m") ? "Male" : "Female"}
                    </span>
                  </div>
                  {profile.tribe && (
                    <div>
                      <span className="text-slate-500 font-sans">Tribal Lineage: </span>
                      <span className="font-semibold text-blue-600">{profile.tribe}</span>
                    </div>
                  )}
                  {profile.unique_attribute && (
                    <div>
                      <span className="text-slate-500 font-sans">Key Attribute: </span>
                      <span className="font-semibold text-slate-700">{profile.unique_attribute}</span>
                    </div>
                  )}
                  {profile.notes && (
                    <div>
                      <div className="text-slate-500 mb-1 font-sans">Biography Notes:</div>
                      <p className="text-slate-650 leading-relaxed text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200 font-serif">
                        {profile.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Relationship Links Card */}
              {relationships.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-5 bg-white shadow-xs">
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3 font-sans">
                    Social Connections
                  </h5>
                  <div className="space-y-1">
                    {relationships.slice(0, 10).map((r, i) => (
                      <button
                        key={i}
                        onClick={() => onSelectPerson(r.relation_id)}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 transition-all text-xs flex items-center justify-between border border-transparent hover:border-slate-200 cursor-pointer"
                      >
                        <span className="text-slate-700">
                          {r.relation_name} <span className="text-slate-500 text-[10px] font-sans">({r.relationship_type})</span>
                        </span>
                        <ChevronRightIcon size={12} className="text-slate-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas for Tree */}
      <div className="flex-1 h-full bg-slate-50 relative overflow-hidden flex items-center justify-center p-6">
        {profile ? (
          <svg className="w-full h-full max-w-[850px] max-h-[600px]" viewBox={`0 0 ${treeLayout.viewBoxWidth} 500`}>
            {/* Draw Relationship Lines */}
            {treeLayout.connections.map((c, i) => {
              const midY = (c.y1 + c.y2) / 2;
              const pathD = `M ${c.x1} ${c.y1} C ${c.x1} ${midY}, ${c.x2} ${midY}, ${c.x2} ${c.y2}`;
              return (
                <path
                  key={i}
                  d={pathD}
                  fill="none"
                  stroke={c.isDouble ? "#2563eb" : "rgba(15, 23, 42, 0.12)"}
                  strokeWidth={c.isDouble ? 2.5 : 1.2}
                  strokeDasharray={c.isDouble ? "0" : "3 3"}
                />
              );
            })}

            {/* Draw Nodes */}
            {treeLayout.nodes.map((node) => {
              const isCenter = node.role === "center";
              const isMale = node.sex === "M";
              
              return (
                <g
                  key={node.id}
                  onClick={() => onSelectPerson(node.id)}
                  className="cursor-pointer select-none group"
                >
                  {/* Node Shape */}
                  <rect
                    x={node.x - 45}
                    y={node.y - 15}
                    width={90}
                    height={30}
                    rx={6}
                    fill={isCenter ? "rgba(37, 99, 235, 0.08)" : "#ffffff"}
                    stroke={
                      isCenter 
                        ? "#2563eb" 
                        : isMale 
                          ? "rgba(14, 165, 233, 0.5)" 
                          : "rgba(124, 58, 237, 0.5)"
                    }
                    strokeWidth={isCenter ? 2 : 1}
                    className="transition-all group-hover:fill-slate-50 shadow-sm"
                  />
                  
                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fill={isCenter ? "#2563eb" : "#0f172a"}
                    fontSize={10}
                    fontWeight={isCenter ? "bold" : "normal"}
                    className="font-sans"
                  >
                    {node.name}
                  </text>
                  
                  {/* Small tag/role label */}
                  <text
                    x={node.x}
                    y={node.y - 18}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={8}
                    className="opacity-0 group-hover:opacity-100 transition-opacity font-mono uppercase tracking-wider"
                  >
                    {node.role}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="text-slate-500 text-xs italic font-sans">No family tree loaded.</div>
        )}

        {/* HUD Overlay */}
        <div className="absolute top-4 left-4 z-10 p-2.5 rounded-xl border flex items-center gap-2 pointer-events-none"
             style={{ background: "rgba(255, 255, 255, 0.95)", borderColor: "#e2e8f0", backdropFilter: "blur(12px)", boxShadow: "0 4px 15px rgba(15, 23, 42, 0.05)" }}>
          <CompassIcon size={14} className="text-blue-500" />
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase font-sans">
            Pedigree Tree Active
          </span>
        </div>
      </div>
    </div>
  );
}
