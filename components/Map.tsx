'use client';

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_CENTER, MAPBOX_STYLE, MAPBOX_ZOOM, CATEGORY_META } from '@/lib/constants';
import type { Incident } from '@/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

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
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<globalThis.Map<string, mapboxgl.Marker>>(new globalThis.Map());

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLE,
      center: MAPBOX_CENTER,
      zoom: MAPBOX_ZOOM,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
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

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
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
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([incident.lng, incident.lat])
        .addTo(map);
      markersRef.current.set(incident.id, marker);
    });
  }, [incidents, onMarkerClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Map may not be ready yet on first render
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
