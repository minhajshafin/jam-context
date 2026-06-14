'use client';

import { useReducer, useState } from 'react';
import CategoryPicker from './CategoryPicker';
import PhotoUploader from './PhotoUploader';
import { GEO_TIMEOUT_MS, DESCRIPTION_MAX_CHARS, CATEGORY_META } from '@/lib/constants';
import type { IncidentCategory, Incident } from '@/types';

type Step = 1 | 2 | 3 | 4;

interface DrawerState {
  step: Step;
  lat: number | null;
  lng: number | null;
  locationMode: 'gps' | 'tap' | null;
  category: IncidentCategory | null;
  photo: File | null;
  description: string;
  submitting: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_LOCATION'; lat: number; lng: number; mode: 'gps' | 'tap' }
  | { type: 'USE_TAP_MODE' }
  | { type: 'SET_CATEGORY'; category: IncidentCategory }
  | { type: 'SET_PHOTO'; photo: File }
  | { type: 'SET_DESCRIPTION'; description: string }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SUBMITTING' }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

const initialState: DrawerState = {
  step: 1, lat: null, lng: null, locationMode: null,
  category: null, photo: null, description: '',
  submitting: false, error: null,
};

function reducer(state: DrawerState, action: Action): DrawerState {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, lat: action.lat, lng: action.lng, locationMode: action.mode, step: 2 };
    case 'USE_TAP_MODE':
      return { ...state, locationMode: 'tap' };
    case 'SET_CATEGORY':
      return { ...state, category: action.category };
    case 'SET_PHOTO':
      return { ...state, photo: action.photo };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.description };
    case 'NEXT':
      return { ...state, step: (state.step + 1) as Step };
    case 'BACK':
      return { ...state, step: (state.step - 1) as Step, error: null };
    case 'SUBMITTING':
      return { ...state, submitting: true, error: null };
    case 'ERROR':
      return { ...state, submitting: false, error: action.message };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

interface ReportDrawerProps {
  open: boolean;
  onClose: () => void;
  onIncidentCreated: (incident: Incident) => void;
  onRequestTapMode: () => void;
  tapPlacedLocation: { lat: number; lng: number } | null;
}

export default function ReportDrawer({
  open, onClose, onIncidentCreated, onRequestTapMode, tapPlacedLocation,
}: ReportDrawerProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoFailed, setGeoFailed] = useState(false);

  // When tap mode places a location, advance to step 2
  if (tapPlacedLocation && state.locationMode === 'tap' && state.lat === null) {
    dispatch({ type: 'SET_LOCATION', lat: tapPlacedLocation.lat, lng: tapPlacedLocation.lng, mode: 'tap' });
  }

  const requestGPS = async () => {
    setGeoLoading(true);
    setGeoFailed(false);

    const result = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      const timeout = setTimeout(() => resolve(null), GEO_TIMEOUT_MS);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timeout); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { clearTimeout(timeout); resolve(null); }
      );
    });

    setGeoLoading(false);

    if (result) {
      dispatch({ type: 'SET_LOCATION', lat: result.lat, lng: result.lng, mode: 'gps' });
    } else {
      setGeoFailed(true);
    }
  };

  const handleTapToPlace = () => {
    dispatch({ type: 'USE_TAP_MODE' });
    onRequestTapMode();
    onClose(); // Close drawer so user can tap the map
  };

  const handleSubmit = async () => {
    if (!state.lat || !state.lng || !state.category || !state.photo) return;
    dispatch({ type: 'SUBMITTING' });

    const formData = new FormData();
    formData.append('category', state.category);
    formData.append('lat', String(state.lat));
    formData.append('lng', String(state.lng));
    formData.append('description', state.description);
    formData.append('photo', state.photo);

    try {
      const res = await fetch('/api/incidents', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        dispatch({ type: 'ERROR', message: err.error ?? 'Submission failed. Please try again.' });
        return;
      }
      const newIncident: Incident = await res.json();
      onIncidentCreated(newIncident);
      dispatch({ type: 'RESET' });
      onClose();
    } catch {
      dispatch({ type: 'ERROR', message: 'Network error. Please try again.' });
    }
  };

  if (!open) return null;

  const STEPS = ['Location', 'Category', 'Details', 'Confirm'];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        <div className="px-5 pb-10 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg">Report an Incident</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors text-xl"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1.5 mb-6">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`h-1 w-full rounded-full transition-all ${
                    i + 1 <= state.step ? 'bg-blue-500' : 'bg-gray-700'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* ── Step 1: Location ── */}
          {state.step === 1 && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <span className="text-5xl">📍</span>
                <h3 className="text-white font-semibold text-lg mt-3">Where is the incident?</h3>
                <p className="text-gray-400 text-sm mt-1">We&apos;ll use your current location or let you place a pin.</p>
              </div>
              <button
                onClick={requestGPS}
                disabled={geoLoading}
                className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {geoLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Locating…</>
                ) : (
                  <>📡 Use My Location</>
                )}
              </button>
              {(geoFailed || true) && (
                <button
                  onClick={handleTapToPlace}
                  className="w-full py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                >
                  🗺 Tap Map to Place Pin
                </button>
              )}
              {geoFailed && (
                <p className="text-center text-yellow-400 text-xs">
                  Location access denied or timed out. Tap the map instead.
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: Category ── */}
          {state.step === 2 && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold">What type of incident?</h3>
              <CategoryPicker value={state.category} onChange={(c) => dispatch({ type: 'SET_CATEGORY', category: c })} />
              <div className="flex gap-3 mt-2">
                <button onClick={() => dispatch({ type: 'BACK' })} className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-200 font-semibold hover:bg-gray-600 transition-colors">
                  Back
                </button>
                <button
                  onClick={() => dispatch({ type: 'NEXT' })}
                  disabled={!state.category}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Photo + Description ── */}
          {state.step === 3 && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold">Add a photo & description</h3>
              <PhotoUploader value={state.photo} onChange={(f) => dispatch({ type: 'SET_PHOTO', photo: f })} />
              <div>
                <textarea
                  value={state.description}
                  onChange={(e) => dispatch({ type: 'SET_DESCRIPTION', description: e.target.value.slice(0, DESCRIPTION_MAX_CHARS) })}
                  placeholder="Brief description (optional)…"
                  rows={3}
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm resize-none border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-500"
                />
                <p className="text-right text-xs text-gray-500 mt-1">
                  {state.description.length}/{DESCRIPTION_MAX_CHARS}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => dispatch({ type: 'BACK' })} className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-200 font-semibold hover:bg-gray-600 transition-colors">
                  Back
                </button>
                <button
                  onClick={() => dispatch({ type: 'NEXT' })}
                  disabled={!state.photo}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Confirm ── */}
          {state.step === 4 && (
            <div className="space-y-4">
              <h3 className="text-white font-semibold">Confirm your report</h3>
              <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span className="text-gray-500">Location</span>
                  <span>{state.locationMode === 'gps' ? '📡 GPS' : '🗺 Pinned on map'}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span className="text-gray-500">Type</span>
                  <span>{state.category ? CATEGORY_META[state.category]?.emoji + ' ' + CATEGORY_META[state.category]?.label : '—'}</span>
                </div>
                {state.description && (
                  <div className="text-gray-300 pt-1 border-t border-gray-700">
                    &quot;{state.description}&quot;
                  </div>
                )}
              </div>
              {state.error && (
                <p className="text-red-400 text-sm text-center">{state.error}</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => dispatch({ type: 'BACK' })} disabled={state.submitting} className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-200 font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50">
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={state.submitting}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {state.submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting…</>
                  ) : '🚀 Submit Report'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
