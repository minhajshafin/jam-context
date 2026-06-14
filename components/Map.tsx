'use client';

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAPBOX_CENTER, MAP_STYLE, MAPBOX_ZOOM, CATEGORY_META } from '@/lib/constants';
import type { Incident } from '@/types';

interface MapProps {
  incidents: Incident[];
  onMarkerClick: (incident: Incident) => void;
  tapToPlaceMode: boolean;
  onMapTap?: (lat: number, lng: number) => void;
}

function createMarkerElement(incident: Incident): HTMLElement {
  const meta = CATEGORY_META[incident.category];
  const size = incident.is_seed ? 32 : 40;

  const el = document.createElement('div');
  el.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    border-radius: 50%;
    background: ${meta.color};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${incident.is_seed ? '14px' : '18px'};
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    border: ${incident.is_seed ? '2px dashed rgba(255,255,255,0.5)' : '2px solid rgba(255,255,255,0.8)'};
    transition: transform 0.15s ease;
    user-select: none;
  `;
  el.textContent = meta.emoji;
  el.title = meta.label;

  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

  return el;
}

export default function Map({ incidents, onMarkerClick, tapToPlaceMode, onMapTap }: MapProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(new globalThis.Map());

  // Initialize map once — no token required for MapLibre + CARTO tiles
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: MAPBOX_CENTER,
      zoom: MAPBOX_ZOOM,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');
  }, []);

  // Tap-to-place handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!tapToPlaceMode) {
      map.getCanvas().style.cursor = '';
      return;
    }

    map.getCanvas().style.cursor = 'crosshair';

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (onMapTap) onMapTap(e.lngLat.lat, e.lngLat.lng);
    };

    map.once('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [tapToPlaceMode, onMapTap]);

  // Sync markers when incidents array changes
  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const incomingIds = new Set(incidents.map(i => i.id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add new markers
    incidents.forEach(incident => {
      if (markersRef.current.has(incident.id)) return;
      const el = createMarkerElement(incident);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onMarkerClick(incident);
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([incident.lng, incident.lat])
        .addTo(map);
      markersRef.current.set(incident.id, marker);
    });
  }, [incidents, onMarkerClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.isStyleLoaded()) {
      syncMarkers();
    } else {
      map.once('load', syncMarkers);
    }
  }, [syncMarkers]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
