"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Compass as CompassIcon, Search as SearchIcon, Users as UsersIcon, Loader2 as LoaderIcon, ChevronRight as ChevronRightIcon } from "lucide-react";
import { fetchBiography } from "@/lib/api";

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
  const treeNodes = useMemo(() => {
    if (!profile) return { nodes: [], connections: [] };

    const nodes: any[] = [];
    const connections: any[] = [];

    // Central Node coordinates
    const centerX = 300;
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

    // 1. Father (Top Left)
    if (fathers.length > 0) {
      const f = fathers[0];
      const fx = centerX - 100;
      const fy = centerY - 100;
      nodes.push({ id: f.relation_id, name: f.relation_name, x: fx, y: fy, role: "father", sex: "M" });
      connections.push({ x1: fx + 40, y1: fy + 20, x2: centerX - 20, y2: centerY - 15 });
    }

    // 2. Mother (Top Right)
    if (mothers.length > 0) {
      const m = mothers[0];
      const mx = centerX + 100;
      const my = centerY - 100;
      nodes.push({ id: m.relation_id, name: m.relation_name, x: mx, y: my, role: "mother", sex: "F" });
      connections.push({ x1: mx - 40, y1: my + 20, x2: centerX + 20, y2: centerY - 15 });
    }

    // 3. Spouses (Right side - staggered)
    spouses.forEach((s, idx) => {
      const sx = centerX + 140;
      const offsetMultiplier = Math.floor((idx + 1) / 2) * (idx % 2 === 0 ? 1 : -1);
      const sy = centerY + offsetMultiplier * 35;
      
      nodes.push({ id: s.relation_id, name: s.relation_name, x: sx, y: sy, role: "spouse", sex: s.relation_sex?.toLowerCase().startsWith("f") ? "F" : "M" });
      connections.push({ x1: centerX + 45, y1: centerY, x2: sx - 45, y2: sy, isDouble: true });
    });

    // 4. Children (Bottom Row - dynamically spaced)
    if (children.length > 0) {
      const stepX = Math.min(110, 480 / Math.max(1, children.length - 1));
      const startX = centerX - ((children.length - 1) * stepX) / 2;
      
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

    return { nodes, connections };
  }, [profile, relationships]);

  const handleNavigateVerse = (verseId: string) => {
    const parts = verseId.split(".");
    onNavigate(parts[0], parseInt(parts[1]), parseInt(parts[2] || "1"));
    onViewChange("read");
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Bio Information Panel */}
      <div
        className="w-80 border-r flex flex-col shrink-0"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
      >
        <div className="h-16 px-4 border-b flex items-center gap-2 shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
          <UsersIcon size={18} style={{ color: "var(--primary)" }} />
          <h3 className="font-bold text-sm" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
            Genealogical Profiles
          </h3>
        </div>

        {/* Profile Search */}
        <form onSubmit={handleSearchSubmit} className="p-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="relative">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID (e.g. David_1)"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-colors"
              style={{
                background: "var(--bg-surface-elevated)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </form>

        {/* Biography Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500 text-xs">
              <LoaderIcon className="animate-spin text-indigo-400" size={20} />
              <span>Loading profile...</span>
            </div>
          ) : error || !profile ? (
            <div className="text-xs text-center py-10 text-slate-500 italic">
              {error || "Select a person to view family relationships."}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-xl font-bold" style={{ color: "var(--primary)" }}>{profile.name}</h4>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">ID: {profile.id}</div>
              </div>

              {nameMeaning && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs leading-normal">
                  <div className="font-semibold text-[10px] uppercase text-slate-505 mb-0.5">Hitchcock Name Meaning</div>
                  <span className="italic text-slate-700">&ldquo;{nameMeaning}&rdquo;</span>
                </div>
              )}

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-500">Gender: </span>
                  <span className="font-semibold text-slate-700">
                    {profile.sex?.toLowerCase().startsWith("m") ? "Male" : "Female"}
                  </span>
                </div>
                {profile.tribe && (
                  <div>
                    <span className="text-slate-500">Tribal Lineage: </span>
                    <span className="font-semibold text-blue-600">{profile.tribe}</span>
                  </div>
                )}
                {profile.unique_attribute && (
                  <div>
                    <span className="text-slate-500">Key Attribute: </span>
                    <span className="font-semibold text-slate-700">{profile.unique_attribute}</span>
                  </div>
                )}
                {profile.notes && (
                  <div>
                    <div className="text-slate-500 mb-1">Biography Notes:</div>
                    <p className="text-slate-600 leading-relaxed text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      {profile.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Relationship Links */}
              {relationships.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Social Connections
                  </h5>
                  <div className="space-y-1">
                    {relationships.slice(0, 10).map((r, i) => (
                      <button
                        key={i}
                        onClick={() => onSelectPerson(r.relation_id)}
                        className="w-full text-left p-2 rounded-lg hover:bg-slate-100 transition-all text-xs flex items-center justify-between border border-transparent hover:border-slate-200 cursor-pointer"
                      >
                        <span className="text-slate-750">
                          {r.relation_name} <span className="text-slate-500 text-[10px]">({r.relationship_type})</span>
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
      <div className="flex-1 h-full bg-[#f8fafc] relative overflow-hidden flex items-center justify-center p-4">
        {profile ? (
          <svg className="w-full h-full max-w-[700px] max-h-[600px]" viewBox="0 0 600 500">
            {/* Draw Relationship Lines */}
            {treeNodes.connections.map((c, i) => {
              const midY = (c.y1 + c.y2) / 2;
              const pathD = `M ${c.x1} ${c.y1} C ${c.x1} ${midY}, ${c.x2} ${midY}, ${c.x2} ${c.y2}`;
              return (
                <path
                  key={i}
                  d={pathD}
                  fill="none"
                  stroke={c.isDouble ? "var(--primary)" : "rgba(15, 23, 42, 0.12)"}
                  strokeWidth={c.isDouble ? 2.5 : 1.2}
                  strokeDasharray={c.isDouble ? "0" : "3 3"}
                />
              );
            })}

            {/* Draw Nodes */}
            {treeNodes.nodes.map((node) => {
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
                    fill={isCenter ? "rgba(37, 99, 235, 0.08)" : "var(--bg-surface-elevated)"}
                    stroke={
                      isCenter 
                        ? "var(--primary)" 
                        : isMale 
                          ? "rgba(14, 165, 233, 0.5)" 
                          : "rgba(124, 58, 237, 0.5)"
                    }
                    strokeWidth={isCenter ? 2 : 1}
                    className="transition-all group-hover:fill-slate-50"
                  />
                  
                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fill={isCenter ? "var(--primary)" : "var(--text-primary)"}
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
                    fill="var(--text-muted)"
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
          <div className="text-slate-500 text-xs italic">No family tree loaded.</div>
        )}

        {/* HUD Overlay */}
        <div className="absolute top-4 left-4 z-10 p-2.5 rounded-xl border flex items-center gap-2 pointer-events-none"
             style={{ background: "rgba(255, 255, 255, 0.95)", borderColor: "var(--border-subtle)", backdropFilter: "blur(12px)", boxShadow: "0 4px 15px rgba(15, 23, 42, 0.05)" }}>
          <CompassIcon size={14} className="text-blue-500" />
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Pedigree Tree Active
          </span>
        </div>
      </div>
    </div>
  );
}
