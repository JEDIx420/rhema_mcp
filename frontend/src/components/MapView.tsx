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
        const marker = L.marker([place.latitude, place.longitude])
          .addTo(leafletInstance)
          .bindPopup(
            `<div class="text-xs p-1" style="color: var(--text-primary)">
              <strong style="font-size: 13px; color: var(--primary);">${place.name}</strong><br/>
              <span style="color: var(--text-muted); font-size: 10px; text-transform: uppercase;">${place.type}</span><br/>
              <div style="margin-top: 5px;">Ref: <strong>${place.verse_id}</strong></div>
            </div>`
          );
        
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
    <div className="flex h-full w-full overflow-hidden">
      {/* Places Sidebar */}
      <div className="w-80 border-r border-slate-200 flex flex-col shrink-0 bg-white">
        <div className="h-16 px-4 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <Compass size={18} className="text-blue-600" />
          <h3 className="font-bold text-sm text-slate-900 font-sans">
            GIS Geography Map
          </h3>
        </div>
        
        {/* Clickable Context Banner */}
        <button
          onClick={() => setShowPicker(true)}
          className="m-3 p-3 bg-blue-50/50 hover:bg-blue-50 text-xs text-blue-600 rounded-xl border border-blue-200/50 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] font-sans font-semibold shadow-xs"
        >
          <span>Current Context:</span>
          <span className="font-bold uppercase flex items-center gap-1">
            {getBookName(book)} {chapter}
            <ChevronDown size={12} />
          </span>
        </button>

        {/* Places List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-500 text-xs">
              <Loader2 className="animate-spin text-blue-500" size={20} />
              <span>Loading coordinates...</span>
            </div>
          ) : places.length === 0 ? (
            <div className="text-center py-20 px-4 text-xs text-slate-400 font-sans flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Compass size={18} />
              </div>
              <p className="font-semibold text-slate-600">No geocoded places.</p>
              <p className="text-[10px] text-slate-400 max-w-[180px] leading-normal text-center">This book chapter does not contain coordinate records in the local atlas.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1 font-sans">
                Places Mentioned ({places.length})
              </div>
              {places.map((place, idx) => {
                const isSelected = selectedPlace === place;
                return (
                  <button
                    key={idx}
                    onClick={() => handlePlaceSelect(place)}
                    className="w-full text-left p-2.5 rounded-xl text-xs hover:bg-slate-50 transition-all flex items-start gap-2.5 cursor-pointer border border-transparent hover:border-slate-200"
                    style={{
                      background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent",
                      borderColor: isSelected ? "rgba(37, 99, 235, 0.2)" : "transparent",
                    }}
                  >
                    <MapPin size={14} className={isSelected ? "text-blue-600 shrink-0 mt-0.5" : "text-slate-450 shrink-0 mt-0.5"} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate flex items-center justify-between">
                        <span>{place.name}</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-normal font-sans">
                          {place.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-550 mt-1 flex items-center justify-between">
                        <span>Ref: <strong className="text-blue-600">{place.verse_id}</strong></span>
                        <span className="font-mono text-[9px]">{place.latitude.toFixed(2)}, {place.longitude.toFixed(2)}</span>
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
          <div className="p-4 border-t border-slate-200 bg-slate-50 shadow-inner">
            <h4 className="font-bold text-xs text-blue-600 mb-1">{selectedPlace.name}</h4>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-sans">Type: {selectedPlace.type}</div>
            <button
              onClick={() => {
                if (onNavigate) {
                  const parts = selectedPlace.verse_id.split(".");
                  onNavigate(parts[0], parseInt(parts[1]), parseInt(parts[2]));
                }
              }}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            >
              <Navigation size={12} />
              Read {selectedPlace.verse_id}
            </button>
          </div>
        )}
      </div>

      {/* Map Canvas */}
      <div className="flex-1 h-full relative" style={{ background: "#f1f5f9" }}>
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Map Header HUD */}
        <div className="absolute top-4 left-4 z-40 p-2.5 rounded-xl border flex items-center gap-2 pointer-events-none"
             style={{ background: "rgba(255, 255, 255, 0.95)", borderColor: "var(--border-subtle)", backdropFilter: "blur(12px)" }}>
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
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
