"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  children_count?: number;
  spouse_count?: number;
}

interface Relationship {
  relationship_type: string;
  relation_name: string;
  relation_id: string;
  relation_sex?: string;
  verse_id: string | null;
  children_count?: number;
  spouse_count?: number;
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

  // Zoom/pan canvas state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 1.08;
    const nextScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    setScale(Math.max(0.3, Math.min(3, nextScale)));
  };

  const zoomIn = () => setScale(s => Math.min(3, s * 1.2));
  const zoomOut = () => setScale(s => Math.max(0.3, s / 1.2));
  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // Recenter whenever the profile changes
  useEffect(() => {
    if (profile && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth || 800;
      const containerHeight = containerRef.current.clientHeight || 500;
      
      const children = relationships.filter(
        (r) => r.relationship_type === "father" || r.relationship_type === "mother" || r.relationship_type === "Creator"
      );
      const childrenCount = children.length;
      const stepX = 160;
      const totalChildrenWidth = Math.max(0, (childrenCount - 1) * stepX);
      const viewBoxWidth = Math.max(800, totalChildrenWidth + 240);
      const centerX = viewBoxWidth / 2;
      const centerY = 200;

      const initialScale = 0.85;
      setScale(initialScale);
      setOffset({
        x: containerWidth / 2 - centerX * initialScale,
        y: containerHeight / 2 - centerY * initialScale - 20,
      });
    }
  }, [profile, relationships]);

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

    const childrenCount = children.length;
    const stepX = 160; // wider step for readable labels and stats
    const totalChildrenWidth = Math.max(0, (childrenCount - 1) * stepX);
    const viewBoxWidth = Math.max(800, totalChildrenWidth + 240);
    const centerX = viewBoxWidth / 2;
    const centerY = 200;

    // Add Central Node
    nodes.push({
      id: profile.id,
      name: profile.name,
      x: centerX,
      y: centerY,
      role: "center",
      sex: profile.sex?.toLowerCase().startsWith("m") || profile.id.toLowerCase().startsWith("jesus") ? "M" : "F",
      childrenCount: profile.children_count || 0,
      spouseCount: profile.spouse_count || 0,
    });

    // 1. Father (Top Left)
    if (fathers.length > 0) {
      const f = fathers[0];
      const fx = centerX - 160;
      const fy = centerY - 120;
      nodes.push({
        id: f.relation_id,
        name: f.relation_name,
        x: fx,
        y: fy,
        role: "father",
        sex: "M",
        childrenCount: f.children_count || 0,
        spouseCount: f.spouse_count || 0,
      });
      connections.push({
        from: f.relation_id,
        to: profile.id,
        x1: fx,
        y1: fy + 22.5,
        x2: centerX - 25,
        y2: centerY - 22.5
      });
    }

    // 2. Mother (Top Right)
    if (mothers.length > 0) {
      const m = mothers[0];
      const mx = centerX + 160;
      const my = centerY - 120;
      nodes.push({
        id: m.relation_id,
        name: m.relation_name,
        x: mx,
        y: my,
        role: "mother",
        sex: "F",
        childrenCount: m.children_count || 0,
        spouseCount: m.spouse_count || 0,
      });
      connections.push({
        from: m.relation_id,
        to: profile.id,
        x1: mx,
        y1: my + 22.5,
        x2: centerX + 25,
        y2: centerY - 22.5
      });
    }

    // 3. Spouses (Right side - staggered)
    spouses.forEach((s, idx) => {
      const sx = centerX + 200;
      const offsetMultiplier = Math.floor((idx + 1) / 2) * (idx % 2 === 0 ? 1 : -1);
      const sy = centerY + offsetMultiplier * 55;
      
      nodes.push({
        id: s.relation_id,
        name: s.relation_name,
        x: sx,
        y: sy,
        role: "spouse",
        sex: s.relation_sex?.toLowerCase().startsWith("f") ? "F" : "M",
        childrenCount: s.children_count || 0,
        spouseCount: s.spouse_count || 0,
      });
      connections.push({
        from: profile.id,
        to: s.relation_id,
        x1: centerX + 60,
        y1: centerY,
        x2: sx - 60,
        y2: sy,
        isDouble: true
      });
    });

    // 4. Children (Bottom Row - dynamically spaced)
    if (childrenCount > 0) {
      const startX = centerX - ((childrenCount - 1) * stepX) / 2;
      
      children.forEach((c, idx) => {
        const cx = startX + idx * stepX;
        const cy = centerY + 140;
        nodes.push({
          id: c.relation_id,
          name: c.relation_name,
          x: cx,
          y: cy,
          role: "child",
          sex: c.relation_sex?.toLowerCase().startsWith("m") ? "M" : "F",
          childrenCount: c.children_count || 0,
          spouseCount: c.spouse_count || 0,
        });
        
        connections.push({
          from: profile.id,
          to: c.relation_id,
          x1: centerX,
          y1: centerY + 22.5,
          x2: cx,
          y2: cy - 22.5
        });
      });
    }

    return { nodes, connections, viewBoxWidth };
  }, [profile, relationships]);

  const handleNavigateVerse = (verseId: string) => {
    const parts = verseId.split(".");
    onNavigate(parts[0], parseInt(parts[1]), parseInt(parts[2] || "1"));
    onViewChange("read");
  };

  const isMale = profile?.sex?.toLowerCase().startsWith("m") || profile?.id.toLowerCase().startsWith("jesus");

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      {/* Bio Information Sidebar */}
      <div className="w-96 border-r border-slate-200 flex flex-col shrink-0 bg-white shadow-xs">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
          <UsersIcon size={20} className="text-blue-600" />
          <h3 className="font-bold text-base font-sans text-slate-900">
            Genealogical Profiles
          </h3>
        </div>

        {/* Profile Search */}
        <form onSubmit={handleSearchSubmit} className="p-5 border-b border-slate-200 bg-slate-50">
          <div className="relative flex items-center bg-white rounded-xl shadow-xs border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
            <SearchIcon size={16} className="absolute left-3.5 pointer-events-none text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search (e.g. David_1)"
              className="w-full pl-10 pr-3.5 py-3 text-base bg-transparent border-none outline-none text-slate-900 placeholder-slate-400 rounded-xl font-sans"
            />
          </div>
        </form>

        {/* Biography Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-500 text-sm">
              <LoaderIcon className="animate-spin text-blue-500" size={24} />
              <span>Loading profile...</span>
            </div>
          ) : error || !profile ? (
            <div className="text-sm text-center py-12 text-slate-500 italic font-sans">
              {error || "Select a person to view family relationships."}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Structured White Details Card */}
              <div className="rounded-xl border border-slate-200 p-6 bg-white shadow-sm space-y-5">
                <div>
                  <h4 className="text-2xl font-bold font-sans text-slate-900">{profile.name}</h4>
                  <div className="text-xs text-slate-550 uppercase tracking-wider font-mono mt-0.5">ID: {profile.id}</div>
                </div>

                {nameMeaning && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-base leading-relaxed">
                    <div className="font-bold text-xs uppercase text-slate-500 mb-1 font-sans">Hitchcock Name Meaning</div>
                    <span className="italic text-slate-800 font-serif">&ldquo;{nameMeaning}&rdquo;</span>
                  </div>
                )}

                <div className="space-y-3.5 text-base text-slate-700">
                  <div>
                    <span className="text-slate-550 font-sans">Gender: </span>
                    <span className="font-semibold text-slate-900">
                      {isMale ? "Male" : "Female"}
                    </span>
                  </div>
                  {profile.tribe && (
                    <div>
                      <span className="text-slate-555 font-sans">Tribal Lineage: </span>
                      <span className="font-bold text-blue-600">{profile.tribe}</span>
                    </div>
                  )}
                  {profile.unique_attribute && (
                    <div>
                      <span className="text-slate-555 font-sans">Key Attribute: </span>
                      <span className="font-semibold text-slate-950">{profile.unique_attribute}</span>
                    </div>
                  )}
                  {profile.notes && (
                    <div className="pt-2">
                      <div className="text-slate-555 mb-2 font-sans font-semibold">Biography Notes:</div>
                      <p className="text-slate-750 leading-relaxed text-[17px] bg-slate-50 p-5 rounded-2xl border border-slate-200 font-prose">
                        {profile.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Relationship Links Card */}
              {relationships.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-6 bg-white shadow-sm">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 font-sans">
                    Social Connections
                  </h5>
                  <div className="space-y-2">
                    {relationships.slice(0, 10).map((r, i) => (
                      <button
                        key={i}
                        onClick={() => onSelectPerson(r.relation_id)}
                        className="w-full text-left p-3.5 rounded-xl hover:bg-slate-50 transition-all text-base flex items-center justify-between border border-transparent hover:border-slate-200 cursor-pointer font-sans"
                      >
                        <span className="text-slate-700 font-medium">
                          {r.relation_name} <span className="text-slate-500 text-xs font-normal">({r.relationship_type})</span>
                        </span>
                        <ChevronRightIcon size={14} className="text-slate-400" />
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
      <div 
        ref={containerRef}
        className="flex-1 h-full bg-[#f8fafc] relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {profile ? (
          <svg className="w-full h-full">
            {/* Grid Pattern that scales/pans */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(15, 23, 42, 0.03)" strokeWidth="1" />
              </pattern>
              {/* Highlight path glow filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
              {/* Draw Relationship Lines */}
              {treeLayout.connections.map((c, i) => {
                const midY = (c.y1 + c.y2) / 2;
                const pathD = `M ${c.x1} ${c.y1} C ${c.x1} ${midY}, ${c.x2} ${midY}, ${c.x2} ${c.y2}`;
                const isHighlighted = hoveredNodeId === c.from || hoveredNodeId === c.to;
                const hasHover = hoveredNodeId !== null;

                return (
                  <g key={i}>
                    {/* Shadow/Glow Line when hovered */}
                    {isHighlighted && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={6}
                        opacity={0.3}
                        filter="url(#glow)"
                      />
                    )}
                    {/* Main Line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={
                        isHighlighted 
                          ? "#2563eb" 
                          : c.isDouble 
                            ? "rgba(37, 99, 235, 0.3)" 
                            : "rgba(15, 23, 42, 0.08)"
                      }
                      strokeWidth={isHighlighted ? 2.5 : c.isDouble ? 2 : 1.2}
                      strokeDasharray={isHighlighted ? "0" : c.isDouble ? "0" : "4 4"}
                      opacity={hasHover && !isHighlighted ? 0.3 : 1}
                      className="transition-all duration-300"
                    />
                    {/* Flowing animated dash indicator for highlighted parent-child links */}
                    {isHighlighted && !c.isDouble && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        strokeDasharray="8 15"
                        opacity={0.8}
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          values="100;0"
                          dur="3s"
                          repeatCount="indefinite"
                        />
                      </path>
                    )}
                  </g>
                );
              })}

              {/* Draw Nodes */}
              {treeLayout.nodes.map((node) => {
                const isCenter = node.role === "center";
                const isMaleNode = node.sex === "M";
                const isHighlighted = hoveredNodeId === node.id;
                const hasHover = hoveredNodeId !== null;

                return (
                  <g
                    key={node.id}
                    onClick={() => {
                      onSelectPerson(node.id);
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    className="cursor-pointer select-none"
                    opacity={hasHover && !isHighlighted ? 0.55 : 1}
                    style={{ transition: "opacity 0.2s ease" }}
                  >
                    {/* Descendant Dotted Lines spreading downward for cards with children */}
                    {node.role !== "center" && node.childrenCount > 0 && (
                      <g opacity={0.65}>
                        <line
                          x1={node.x}
                          y1={node.y + 22.5}
                          x2={node.x}
                          y2={node.y + 38}
                          stroke="#64748b"
                          strokeWidth={1.5}
                          strokeDasharray="2 2"
                        />
                        <path
                          d={`M ${node.x} ${node.y + 22.5} Q ${node.x - 8} ${node.y + 30}, ${node.x - 14} ${node.y + 36}`}
                          fill="none"
                          stroke="#64748b"
                          strokeWidth={1.5}
                          strokeDasharray="2 2"
                        />
                        <path
                          d={`M ${node.x} ${node.y + 22.5} Q ${node.x + 8} ${node.y + 30}, ${node.x + 14} ${node.y + 36}`}
                          fill="none"
                          stroke="#64748b"
                          strokeWidth={1.5}
                          strokeDasharray="2 2"
                        />
                      </g>
                    )}

                    {/* Node Card background */}
                    <rect
                      x={node.x - 65}
                      y={node.y - 22.5}
                      width={130}
                      height={45}
                      rx={10}
                      fill="#ffffff"
                      stroke={
                        isHighlighted
                          ? "#2563eb"
                          : isCenter
                            ? "#2563eb"
                            : isMaleNode
                              ? "rgba(14, 165, 233, 0.35)"
                              : "rgba(168, 85, 247, 0.35)"
                      }
                      strokeWidth={isCenter ? 2.5 : isHighlighted ? 2.2 : 1}
                      className="transition-all duration-200 shadow-xs"
                      style={{
                        filter: isHighlighted ? "drop-shadow(0 4px 10px rgba(37, 99, 235, 0.15))" : "none"
                      }}
                    />

                    {/* Gender Indicator Stripe */}
                    <rect
                      x={node.x - 65}
                      y={node.y - 22.5}
                      width={4}
                      height={45}
                      rx={2}
                      fill={
                        isCenter
                          ? "#f59e0b"
                          : isMaleNode
                            ? "#0ea5e9"
                            : "#a855f7"
                      }
                    />

                    {/* Label */}
                    <text
                      x={node.x + 2}
                      y={node.y - 2}
                      textAnchor="middle"
                      fill="#0f172a"
                      fontSize={11}
                      fontWeight="bold"
                      className="font-sans"
                    >
                      {node.name}
                    </text>

                    {/* Stats pills: Children and Spouses counts */}
                    <g transform={`translate(${node.x + 2}, ${node.y + 12})`}>
                      {/* Children count badge */}
                      {node.childrenCount > 0 && (
                        <g transform={`translate(${node.spouseCount > 0 ? -18 : 0}, 0)`}>
                          <text textAnchor="middle" fill="#64748b" fontSize={9} className="font-sans font-semibold">
                            👶 {node.childrenCount}
                          </text>
                        </g>
                      )}
                      {/* Spouse count badge */}
                      {node.spouseCount > 0 && (
                        <g transform={`translate(${node.childrenCount > 0 ? 18 : 0}, 0)`}>
                          <text textAnchor="middle" fill="#64748b" fontSize={9} className="font-sans font-semibold">
                            👥 {node.spouseCount}
                          </text>
                        </g>
                      )}
                      {/* If both counts are 0, show a small role label */}
                      {node.childrenCount === 0 && node.spouseCount === 0 && (
                        <text textAnchor="middle" fill="#94a3b8" fontSize={8} fontWeight="bold" className="font-mono uppercase tracking-wider">
                          {node.role}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        ) : (
          <div className="text-slate-400 text-base italic font-sans">No family tree loaded.</div>
        )}

        {/* Zoom HUD Controls */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
          <button
            onClick={zoomIn}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-800 hover:bg-slate-50 transition-all font-bold text-lg select-none cursor-pointer"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-800 hover:bg-slate-50 transition-all font-bold text-lg select-none cursor-pointer"
          >
            −
          </button>
          <button
            onClick={resetZoom}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all text-xs font-semibold select-none cursor-pointer"
          >
            Reset
          </button>
        </div>

        {/* HUD Overlay */}
        <div className="absolute top-4 left-4 z-10 p-3.5 rounded-xl border flex flex-col gap-1 pointer-events-none"
             style={{ background: "rgba(255, 255, 255, 0.9)", borderColor: "#e2e8f0", backdropFilter: "blur(8px)", boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)" }}>
          <div className="flex items-center gap-2">
            <CompassIcon size={14} className="text-blue-500" />
            <span className="text-[10px] font-bold tracking-wider text-slate-600 uppercase font-sans">
              Interactive Web Tree
            </span>
          </div>
          <span className="text-[9px] text-slate-450 font-sans mt-0.5">
            Drag to pan • Scroll to zoom • Hover cards to trace connections
          </span>
        </div>
      </div>
    </div>
  );
}
