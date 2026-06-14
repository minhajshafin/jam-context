'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import IncidentSheet from '@/components/IncidentSheet';
import ReportDrawer from '@/components/ReportDrawer';
import { POLL_INTERVAL_MS, CATEGORY_META } from '@/lib/constants';
import type { Incident } from '@/types';

// Mapbox must be client-only (no SSR)
const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function Home() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [tapToPlaceMode, setTapToPlaceMode] = useState(false);
  const [tapPlacedLocation, setTapPlacedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents');
      if (!res.ok) throw new Error();
      const data: Incident[] = await res.json();
      setIncidents(data);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const handleMapTap = useCallback((lat: number, lng: number) => {
    setTapPlacedLocation({ lat, lng });
    setTapToPlaceMode(false);
    setReportOpen(true);
  }, []);

  const handleIncidentCreated = (incident: Incident) => {
    setIncidents(prev => [incident, ...prev]);
    showToast('📍 Report submitted! Your pin is now live.');
  };

  return (
    <main className="relative w-screen h-screen bg-gray-950 overflow-hidden">
      {/* Map */}
      <Map
        incidents={incidents}
        onMarkerClick={(incident) => {
          setSelectedIncident(incident);
          setReportOpen(false);
        }}
        tapToPlaceMode={tapToPlaceMode}
        onMapTap={handleMapTap}
      />

      {/* Tap-to-place banner */}
      {tapToPlaceMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white px-5 py-3 rounded-full text-sm font-semibold shadow-lg flex items-center gap-2 animate-fade-in">
          <span>🗺</span>
          <span>Tap the map to place your report pin</span>
          <button
            onClick={() => setTapToPlaceMode(false)}
            className="ml-2 text-white/70 hover:text-white text-lg leading-none"
            aria-label="Cancel tap to place"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-gray-700/50">
          <h1 className="text-white font-bold text-base leading-tight">Dhaka Traffic</h1>
          <p className="text-gray-400 text-xs mt-0.5">Community incident map</p>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-14 z-20 pointer-events-none">
        <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl px-3 py-2 shadow-lg border border-gray-700/50 space-y-1">
          {Object.entries(CATEGORY_META).map(([, meta]) => (
            <div key={meta.label} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: meta.color }}
              />
              <span className="text-gray-300 text-xs">{meta.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl px-6 py-4 flex items-center gap-3 shadow-xl border border-gray-700">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-300 text-sm">Loading incidents…</span>
          </div>
        </div>
      )}

      {/* Fetch error */}
      {fetchError && !loading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={fetchIncidents}
            className="bg-red-900/80 backdrop-blur-sm text-red-200 px-4 py-2 rounded-full text-sm border border-red-700 hover:bg-red-900 transition-colors"
          >
            ⚠️ Could not load incidents — tap to retry
          </button>
        </div>
      )}

      {/* Incident count badge */}
      {!loading && incidents.length > 0 && (
        <div className="absolute bottom-28 left-4 z-20 pointer-events-none">
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs text-gray-400 border border-gray-700">
            {incidents.filter(i => !i.is_seed).length > 0
              ? `${incidents.length} active reports (${incidents.filter(i => i.is_seed).length} demo)`
              : `${incidents.filter(i => i.is_seed).length} demo reports — be the first to report!`
            }
          </div>
        </div>
      )}

      {/* Report FAB */}
      {!tapToPlaceMode && (
        <button
          id="report-fab"
          onClick={() => {
            setSelectedIncident(null);
            setTapPlacedLocation(null);
            setReportOpen(true);
          }}
          className="absolute bottom-8 right-5 z-30 w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-2xl flex items-center justify-center transition-all border-2 border-blue-400/40"
          aria-label="Report a new incident"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Incident detail sheet */}
      <IncidentSheet
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />

      {/* Report drawer */}
      <ReportDrawer
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onIncidentCreated={handleIncidentCreated}
        onRequestTapMode={() => {
          setReportOpen(false);
          setTapToPlaceMode(true);
        }}
        tapPlacedLocation={tapPlacedLocation}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-gray-800 text-white px-5 py-2.5 rounded-full text-sm shadow-xl border border-gray-600 animate-fade-in">
          {toast}
        </div>
      )}
    </main>
  );
}
