"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, MapPin, Compass, Navigation, ChevronDown, Flag } from "lucide-react";
import { fetchChapterMap, fetchGeographyRoutes, fetchRoutePoints } from "@/lib/api";
import { getBookName } from "@/lib/books";
import BookChapterPickerModal from "./BookChapterPickerModal";
import { setGlassDragImage } from "@/lib/drag";
import { useEnglishTranslation } from "@/components/EnglishTranslationProvider";

interface MapPlace {
  name: string;
  latitude: number | null;
  longitude: number | null;
  type: string;
  verse_id: string;
  text_en?: string;
  text_original?: string;
  meaning?: string | null;
  commentary?: string | null;
  dict_definition?: string | null;
}

interface Route {
  route_id: string;
  title: string;
  description: string;
}

interface RoutePoint {
  sequence_order: number;
  latitude: number;
  longitude: number;
  place_name: string;
  associated_verse_id: string;
  text_en?: string;
  text_original?: string;
}

interface MapViewProps {
  book: string;
  chapter: number;
  onNavigate?: (book: string, chapter: number, verse?: number) => void;
}

export default function MapView({ book, chapter, onNavigate }: MapViewProps) {
  const { activeEnglishTranslation } = useEnglishTranslation();
  const [activeTab, setActiveTab] = useState<"chapter" | "routes">("chapter");
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Routes state
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [selectedRoutePoint, setSelectedRoutePoint] = useState<RoutePoint | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);

  // Define handleRouteSelect above the useEffect that calls it
  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId);
    setSelectedRoutePoint(null);
    Promise.resolve().then(() => {
      setLoading(true);
    });
    fetchRoutePoints(routeId)
      .then((data) => {
        setRoutePoints(data.points || []);
      })
      .catch(() => {
        setRoutePoints([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedRouteId) handleRouteSelect(selectedRouteId);
    // Translation changes refresh the selected route's verse excerpts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnglishTranslation]);

  // 1. Fetch map places for current book & chapter
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
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
  }, [book, chapter, activeEnglishTranslation]);

  // Fetch routes list when activeTab is "routes" and list is empty
  useEffect(() => {
    if (activeTab === "routes" && routes.length === 0) {
      Promise.resolve().then(() => {
        setLoadingRoutes(true);
      });
      fetchGeographyRoutes()
        .then((data) => {
          setRoutes(data.routes || []);
          if (data.routes && data.routes.length > 0) {
            handleRouteSelect(data.routes[0].route_id);
          }
        })
        .catch(() => {
          setRoutes([]);
        })
        .finally(() => {
          setLoadingRoutes(false);
        });
    }
  }, [activeTab, routes.length]);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    let observer: ResizeObserver | null = null;
    if (mapRef.current) {
      observer = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      observer.observe(mapRef.current);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  // 3. Update Markers and Polylines when places, activeTab, or routePoints change
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      const leafletInstance = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      // Clear existing polyline
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      // Listen for popupopen to make elements inside popups draggable
      leafletInstance.off("popupopen");
      leafletInstance.on("popupopen", (e: any) => {
        const popupEl = e.popup.getElement();
        if (popupEl) {
          const draggableElements = popupEl.querySelectorAll(".popup-draggable-quote");
          draggableElements.forEach((el: any) => {
            el.setAttribute("draggable", "true");
            el.style.cursor = "grab";
            
            if (el.dataset.dragBound) return;
            el.dataset.dragBound = "true";

            el.addEventListener("dragstart", (dragEvt: any) => {
              const text = el.innerText || el.textContent || "";
              const refId = el.getAttribute("data-ref-id") || "[MAP POPUP]";
              if (dragEvt.dataTransfer) {
                dragEvt.dataTransfer.setData("text/plain", text);
                dragEvt.dataTransfer.setData("application/verse-id", refId);
                dragEvt.dataTransfer.effectAllowed = "copy";
                setGlassDragImage(dragEvt, `Map Detail`);
              }
              const startEvent = new CustomEvent("rhelo-drag-start", { detail: { verseId: refId, verseText: text } });
              window.dispatchEvent(startEvent);
            });
            el.addEventListener("dragend", () => {
              const endEvent = new CustomEvent("rhelo-drag-end");
              window.dispatchEvent(endEvent);
            });
          });
        }
      });

      // Helper to make leaflet marker elements HTML5-draggable
      const setupDragForMarker = (markerInstance: any, placeName: string, lat: number, lng: number, verseId?: string) => {
        const setup = () => {
          const el = markerInstance.getElement();
          if (el) {
            el.setAttribute("draggable", "true");
            el.style.cursor = "grab";
            el.addEventListener("dragstart", (e: any) => {
              const text = `${placeName} (Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)})${verseId ? ` - Referenced in ${verseId}` : ""}`;
              const refId = `[PLACE] ${placeName}`;
              if (e.dataTransfer) {
                e.dataTransfer.setData("text/plain", text);
                e.dataTransfer.setData("application/verse-id", refId);
                e.dataTransfer.effectAllowed = "copy";
                setGlassDragImage(e, `${placeName}`);
              }
              const dragEvent = new CustomEvent("rhelo-drag-start", { detail: { verseId: refId, verseText: text } });
              window.dispatchEvent(dragEvent);
            });
            el.addEventListener("dragend", () => {
              const dragEndEvent = new CustomEvent("rhelo-drag-end");
              window.dispatchEvent(dragEndEvent);
            });
          }
        };
        setup();
        // Also attach to add event in case DOM element isn't created yet
        markerInstance.on("add", setup);
      };

      if (activeTab === "chapter") {
        if (places.length === 0) return;
        const group: [number, number][] = [];

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
                <div class="popup-draggable-quote" data-ref-id="[PLACE] ${place.name} (${place.verse_id})" style="font-family: Georgia, serif; font-size: 13px; color: #334155; background-color: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9; font-style: italic; cursor: grab;">
                  &ldquo;${place.text_en || "Verse text not loaded"}&rdquo;
                </div>
                ${place.text_original ? `<div class="popup-draggable-quote" data-ref-id="[PLACE] ${place.name} (${place.verse_id} - Original)" style="font-family: Georgia, serif; font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600; cursor: grab;">${place.text_original}</div>` : ""}
              </div>
              ${place.dict_definition ? `
                <div style="margin-bottom: 8px;">
                  <span style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px;">Easton/Smith Bible Dictionary</span>
                  <div class="popup-draggable-quote" data-ref-id="[DICT] ${place.name}" style="font-size: 11px; color: #475569; background-color: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; cursor: grab;" title="${place.dict_definition.replace(/"/g, '&quot;')}">
                    ${place.dict_definition}
                  </div>
                </div>
              ` : ""}
              <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Coords: ${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}</div>
            </div>
          `;

          const marker = L.marker([place.latitude, place.longitude])
            .bindPopup(popupContent)
            .addTo(leafletInstance);
          
          setupDragForMarker(marker, place.name, place.latitude, place.longitude, place.verse_id);

          markersRef.current.push(marker);
          group.push([place.latitude, place.longitude]);

          marker.on("click", () => {
            setSelectedPlace(place);
          });
        });

        if (group.length > 0) {
          leafletInstance.fitBounds(L.latLngBounds(group), { padding: [50, 50] });
        }
      } else {
        // Routes view
        if (routePoints.length === 0) return;
        const group: [number, number][] = [];

        routePoints.forEach((point) => {
          if (point.latitude == null || point.longitude == null) return;
          const popupContent = `
            <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.5; color: #1e293b; max-width: 280px; padding: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; gap: 8px;">
                <strong style="font-size: 15px; color: #2563eb;">${point.place_name}</strong>
                <span style="font-size: 10px; font-weight: bold; background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 9999px;">Step ${point.sequence_order}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <span style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px;">Biblical Connection (${point.associated_verse_id})</span>
                <div class="popup-draggable-quote" data-ref-id="[ROUTE] ${point.place_name} (${point.associated_verse_id})" style="font-family: Georgia, serif; font-size: 13px; color: #334155; background-color: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #f1f5f9; font-style: italic; cursor: grab;">
                  &ldquo;${point.text_en || "Verse text not loaded"}&rdquo;
                </div>
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Coords: ${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}</div>
            </div>
          `;

          const marker = L.marker([point.latitude, point.longitude], {
            icon: L.divIcon({
              className: "custom-div-icon",
              html: `
                <div style="background-color: #2563eb; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                  ${point.sequence_order}
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            })
          })
          .bindPopup(popupContent)
          .addTo(leafletInstance);

          setupDragForMarker(marker, point.place_name, point.latitude, point.longitude, point.associated_verse_id || undefined);

          markersRef.current.push(marker);
          group.push([point.latitude, point.longitude]);

          marker.on("click", () => {
            setSelectedRoutePoint(point);
          });
        });

        // Add connecting polyline
        if (group.length > 1) {
          polylineRef.current = L.polyline(group, {
            color: "#2563eb",
            weight: 3,
            dashArray: "6, 6",
            opacity: 0.8
          }).addTo(leafletInstance);
        }

        if (group.length > 0) {
          leafletInstance.fitBounds(L.latLngBounds(group), { padding: [50, 50] });
        }
      }
    });
  }, [places, activeTab, routePoints]);

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

  const handleDragStart = (e: React.DragEvent, placeName: string, lat: number | null, lng: number | null, verseId?: string) => {
    const text = `${placeName}${lat != null && lng != null ? ` (Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)})` : ""}${verseId ? ` - Referenced in ${verseId}` : ""}`;
    const refId = `[PLACE] ${placeName}`;
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.setData("application/verse-id", refId);
    e.dataTransfer.effectAllowed = "copy";
    
    // Set glassmorphic drag visual feedback
    setGlassDragImage(e, `${placeName}`);

    const dragEvent = new CustomEvent("rhelo-drag-start", { detail: { verseId: refId, verseText: text } });
    window.dispatchEvent(dragEvent);
  };

  const handleDragEnd = () => {
    const dragEndEvent = new CustomEvent("rhelo-drag-end");
    window.dispatchEvent(dragEndEvent);
  };

  const handleRoutePointClick = (point: RoutePoint) => {
    setSelectedRoutePoint(point);
    if (point.latitude == null || point.longitude == null) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([point.latitude, point.longitude], 10);
      
      const idx = routePoints.indexOf(point);
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("chapter")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer text-center font-sans ${
              activeTab === "chapter"
                ? "bg-white text-blue-600 shadow-xs border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            Chapter Atlas
          </button>
          <button
            onClick={() => setActiveTab("routes")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer text-center font-sans ${
              activeTab === "routes"
                ? "bg-white text-blue-600 shadow-xs border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            Biblical Routes
          </button>
        </div>
        
        {/* Clickable Context Banner - Only show for Chapter view */}
        {activeTab === "chapter" && (
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
        )}

        {/* Select Route Dropdown - Only show for Routes view */}
        {activeTab === "routes" && (
          <div className="p-4 border-b border-slate-100 flex flex-col gap-1.5 shrink-0 bg-slate-50/50">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Select Journey</label>
            <select
              value={selectedRouteId || ""}
              onChange={(e) => handleRouteSelect(e.target.value)}
              className="bg-white border border-slate-200 text-slate-850 text-sm font-semibold rounded-xl px-3 py-2 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 font-sans"
            >
              {routes.map((r) => (
                <option key={r.route_id} value={r.route_id}>
                  {r.title}
                </option>
              ))}
            </select>
            {selectedRouteId && routes.find(r => r.route_id === selectedRouteId)?.description && (
              <p className="text-[11px] text-slate-500 font-sans leading-relaxed mt-1">
                {routes.find(r => r.route_id === selectedRouteId)?.description}
              </p>
            )}
          </div>
        )}

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === "chapter" ? (
            loading ? (
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
                    <div
                      key={idx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, place.name, place.latitude, place.longitude, place.verse_id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handlePlaceSelect(place)}
                      className="w-full text-left p-3.5 rounded-xl text-base hover:bg-slate-50 transition-all flex items-start gap-3 cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 font-sans"
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
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            // Routes View
            loadingRoutes ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-500 text-sm">
                <Loader2 className="animate-spin text-blue-500" size={24} />
                <span>Loading journeys...</span>
              </div>
            ) : routePoints.length === 0 ? (
              <div className="text-center py-24 px-5 text-sm text-slate-400 font-sans flex flex-col items-center justify-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200/50">
                  <Compass size={20} />
                </div>
                <p className="font-bold text-slate-700">No route coordinates.</p>
                <p className="text-sm text-slate-500 max-w-[220px] leading-relaxed text-center font-sans mt-0.5">Please select another route.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 py-1 font-sans flex items-center gap-1">
                  <Flag size={12} className="text-blue-500" /> Journey Path ({routePoints.length} Stops)
                </div>
                {routePoints.map((point) => {
                  const isSelected = selectedRoutePoint === point;
                  return (
                    <div
                      key={point.sequence_order}
                      draggable
                      onDragStart={(e) => handleDragStart(e, point.place_name, point.latitude, point.longitude, point.associated_verse_id || undefined)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleRoutePointClick(point)}
                      className="w-full text-left p-3.5 rounded-xl text-base hover:bg-slate-50 transition-all flex items-start gap-3 cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 font-sans"
                      style={{
                        background: isSelected ? "rgba(37, 99, 235, 0.05)" : "transparent",
                        borderColor: isSelected ? "rgba(37, 99, 235, 0.2)" : "transparent",
                      }}
                    >
                      <div className="w-6 h-6 rounded-full text-blue-600 border border-blue-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5" style={{ background: isSelected ? "var(--primary)" : "rgba(37,99,235,0.08)", color: isSelected ? "#fff" : "var(--primary)" }}>
                        {point.sequence_order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate flex items-center justify-between font-sans">
                          <span>{point.place_name}</span>
                        </div>
                        {point.associated_verse_id && (
                          <div className="text-sm text-slate-500 mt-1 flex items-center justify-between font-sans">
                            <span>Ref: <strong className="text-blue-600">{point.associated_verse_id}</strong></span>
                            <span className="font-mono text-xs text-slate-400">
                              {point.latitude.toFixed(2)}, {point.longitude.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Bottom Details Panel */}
        {activeTab === "chapter" && selectedPlace && (
          <div className="p-5 border-t border-slate-200 bg-slate-50 shadow-inner">
            <h4 className="font-bold text-base text-blue-600 mb-1.5 font-sans">{selectedPlace.name}</h4>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-sans">Type: {selectedPlace.type}</div>
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

        {activeTab === "routes" && selectedRoutePoint && (
          <div className="p-5 border-t border-slate-200 bg-slate-50 shadow-inner">
            <h4 className="font-bold text-base text-blue-600 mb-1.5 font-sans">
              #{selectedRoutePoint.sequence_order}: {selectedRoutePoint.place_name}
            </h4>
            {selectedRoutePoint.associated_verse_id && (
              <>
                <div className="text-xs text-slate-505 uppercase tracking-wider mb-3 font-sans">
                  Associated Verse: {selectedRoutePoint.associated_verse_id}
                </div>
                <button
                  onClick={() => {
                    if (onNavigate) {
                      const parts = selectedRoutePoint.associated_verse_id.split(".");
                      onNavigate(parts[0], parseInt(parts[1]), parseInt(parts[2]));
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-base font-bold cursor-pointer transition-colors shadow-xs font-sans"
                >
                  <Navigation size={14} />
                  Read {selectedRoutePoint.associated_verse_id}
                </button>
              </>
            )}
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
