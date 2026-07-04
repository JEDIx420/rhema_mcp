"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, MapPin, Compass, Navigation, ChevronDown } from "lucide-react";
import { fetchChapterMap } from "@/lib/api";
import { getBookName } from "@/lib/books";
import BookChapterPickerModal from "./BookChapterPickerModal";

interface MapPlace {
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  verse_id: string;
  text_en?: string;
  text_original?: string;
  meaning?: string | null;
  commentary?: string | null;
  dict_definition?: string | null;
}

interface MapViewProps {
  book: string;
  chapter: number;
  onNavigate?: (book: string, chapter: number, verse?: number) => void;
}

export default function MapView({ book, chapter, onNavigate }: MapViewProps) {
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // 1. Fetch map places for current book & chapter
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchChapterMap(book, chapter)
      .then((data) => {
        if (active) {
          setPlaces(data.places || []);
        }
      })
      .catch(() => {
        if (active) setPlaces([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [book, chapter]);

  // 2. Initialize Leaflet Map client-side
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    // Dynamically inject Leaflet stylesheet if not present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let L: any;
    
    // Load Leaflet library dynamically
    import("leaflet").then((Leaflet) => {
      L = Leaflet.default || Leaflet;

      // Fix Leaflet marker icon paths in Next.js
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapInstanceRef.current && mapRef.current) {
        // Center on Jerusalem / Ancient Near East area by default
        mapInstanceRef.current = L.map(mapRef.current, {
          zoomControl: false
        }).setView([31.7683, 35.2137], 6);
        
        L.control.zoom({ position: "bottomright" }).addTo(mapInstanceRef.current);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; CartoDB',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(mapInstanceRef.current);
      }
    });

    return () => {
      // Map instance is preserved, we'll just clear markers when places change
    };
  }, []);

  // 3. Update Markers when places list changes
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      const leafletInstance = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      if (places.length === 0) return;

      const group: any[] = [];

      places.forEach((place) => {
        if (place.latitude == null || place.longitude == null) return;
        const popupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.5; color: #1e293b; max-width: 280px; padding: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; gap: 8px;">
              <strong style="font-size: 15px; color: #2563eb;">${place.name}</strong>
              <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; background-color: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 9999px;">${place.type}</span>
            </div>
            ${place.meaning ? `<div style="font-style: italic; color: #7c3aed; font-size: 11px; margin-bottom: 6px; font-family: Georgia, serif;">"Meaning: ${place.meaning}"</div>` : ""}
            <div style="margin-bottom: 8px;">
              <span style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px;">Scripture Reference (${place.verse_id})</span>
              <div style="font-family: Georgia, serif; font-size: 13px; color: #334155; background-color: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9; font-style: italic;">
                &ldquo;${place.text_en || "Verse text not loaded"}&rdquo;
              </div>
              ${place.text_original ? `<div style="font-family: Georgia, serif; font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600;">${place.text_original}</div>` : ""}
            </div>
            ${place.dict_definition ? `
              <div style="margin-bottom: 8px;">
                <span style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px;">Easton/Smith Bible Dictionary</span>
                <div style="font-size: 11px; color: #475569; background-color: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;" title="${place.dict_definition.replace(/"/g, '&quot;')}">
                  ${place.dict_definition}
                </div>
              </div>
            ` : ""}
            ${place.commentary ? `
              <div>
                <span style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px;">Commentary Snippet</span>
                <div style="font-size: 11px; color: #475569; background-color: rgba(37,99,235,0.02); padding: 8px; border-radius: 8px; border: 1px solid rgba(37,99,235,0.05); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                  ${place.commentary}
                </div>
              </div>
            ` : ""}
          </div>
        `;

        const marker = L.marker([place.latitude, place.longitude])
          .addTo(leafletInstance)
          .bindPopup(popupContent);
        
        // Save marker reference
        markersRef.current.push(marker);
        group.push([place.latitude, place.longitude]);

        marker.on("click", () => {
          setSelectedPlace(place);
        });
      });

      // Fit map bounds to places
      if (group.length > 0) {
        leafletInstance.fitBounds(L.latLngBounds(group), { padding: [50, 50] });
      }
    });
  }, [places]);

  const handlePlaceSelect = (place: MapPlace) => {
    setSelectedPlace(place);
    if (place.latitude == null || place.longitude == null) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([place.latitude, place.longitude], 10);
      
      // Find corresponding marker and open popup
      const idx = places.indexOf(place);
      if (idx !== -1 && markersRef.current[idx]) {
        markersRef.current[idx].openPopup();
      }
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      {/* Places Sidebar */}
      <div className="w-96 border-r border-slate-200 flex flex-col shrink-0 bg-white">
        <div className="h-16 px-5 border-b border-slate-200 flex items-center gap-2.5 shrink-0">
          <Compass size={20} className="text-blue-600" />
          <h3 className="font-bold text-base text-slate-900 font-sans">
            GIS Geography Map
          </h3>
        </div>
        
        {/* Clickable Context Banner */}
        <button
          onClick={() => setShowPicker(true)}
          className="m-4 p-4 bg-blue-50/50 hover:bg-blue-50 text-base text-blue-600 rounded-xl border border-blue-200/50 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] font-sans font-semibold shadow-xs"
        >
          <span>Current Context:</span>
          <span className="font-bold uppercase flex items-center gap-1">
            {getBookName(book)} {chapter}
            <ChevronDown size={14} />
          </span>
        </button>

        {/* Places List */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-500 text-sm">
              <Loader2 className="animate-spin text-blue-500" size={24} />
              <span>Loading coordinates...</span>
            </div>
          ) : places.length === 0 ? (
            <div className="text-center py-24 px-5 text-sm text-slate-400 font-sans flex flex-col items-center justify-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200/50">
                <Compass size={20} />
              </div>
              <p className="font-bold text-slate-700">No geocoded places.</p>
              <p className="text-sm text-slate-500 max-w-[220px] leading-relaxed text-center font-sans mt-0.5">This book chapter does not contain coordinate records in the local atlas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 py-1 font-sans">
                Places Mentioned ({places.length})
              </div>
              {places.map((place, idx) => {
                const isSelected = selectedPlace === place;
                return (
                  <button
                    key={idx}
                    onClick={() => handlePlaceSelect(place)}
                    className="w-full text-left p-3.5 rounded-xl text-base hover:bg-slate-50 transition-all flex items-start gap-3 cursor-pointer border border-transparent hover:border-slate-200 font-sans"
                    style={{
                      background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent",
                      borderColor: isSelected ? "rgba(37, 99, 235, 0.2)" : "transparent",
                    }}
                  >
                    <MapPin size={16} className={isSelected ? "text-blue-600 shrink-0 mt-0.5" : "text-slate-400 shrink-0 mt-0.5"} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate flex items-center justify-between font-sans">
                        <span>{place.name}</span>
                        <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-650 font-semibold font-sans">
                          {place.type}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1 flex items-center justify-between font-sans">
                        <span>Ref: <strong className="text-blue-600">{place.verse_id}</strong></span>
                        <span className="font-mono text-xs text-slate-400">
                          {place.latitude != null && place.longitude != null 
                            ? `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}` 
                            : "No coordinates"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Details Panel */}
        {selectedPlace && (
          <div className="p-5 border-t border-slate-200 bg-slate-50 shadow-inner">
            <h4 className="font-bold text-base text-blue-600 mb-1.5 font-sans">{selectedPlace.name}</h4>
            <div className="text-xs text-slate-505 uppercase tracking-wider mb-3 font-sans">Type: {selectedPlace.type}</div>
            <button
              onClick={() => {
                if (onNavigate) {
                  const parts = selectedPlace.verse_id.split(".");
                  onNavigate(parts[0], parseInt(parts[1]), parseInt(parts[2]));
                }
              }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-base font-bold cursor-pointer transition-colors shadow-xs font-sans"
            >
              <Navigation size={14} />
              Read {selectedPlace.verse_id}
            </button>
          </div>
        )}
      </div>

      {/* Map Canvas */}
      <div className="flex-1 h-full relative" style={{ background: "#f1f5f9" }}>
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Map Header HUD */}
        <div className="absolute top-4 left-4 z-40 p-3 rounded-xl border border-slate-200 flex items-center gap-2.5 pointer-events-none bg-white/95 backdrop-blur-md shadow-sm">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-slate-500 uppercase font-sans">
            GIS Satellite Link Active
          </span>
        </div>
      </div>

      <BookChapterPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        selectedBook={book}
        selectedChapter={chapter}
        onSelect={(b, c) => {
          if (onNavigate) {
            onNavigate(b, c);
          }
        }}
      />
    </div>
  );
}
