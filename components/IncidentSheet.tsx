'use client';

import { useState } from 'react';
import { CATEGORY_META, NEARBY_RADIUS_METRES } from '@/lib/constants';
import type { Incident, VoteDirection } from '@/types';

interface IncidentSheetProps {
  incident: Incident | null;
  onClose: () => void;
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function getVotedIncidents(): Set<string> {
  try {
    const raw = localStorage.getItem('voted_incidents');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markVoted(id: string) {
  const voted = getVotedIncidents();
  voted.add(id);
  localStorage.setItem('voted_incidents', JSON.stringify([...voted]));
}

export default function IncidentSheet({ incident, onClose }: IncidentSheetProps) {
  const [voteState, setVoteState] = useState<{
    upvotes: number;
    downvotes: number;
    voted: boolean;
    error: string | null;
    loading: boolean;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  if (!incident) return null;

  const meta = CATEGORY_META[incident.category];
  const hasVoted = voteState?.voted ?? getVotedIncidents().has(incident.id);
  const upvotes = voteState?.upvotes ?? incident.upvotes;
  const downvotes = voteState?.downvotes ?? incident.downvotes;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleVote = async (direction: VoteDirection) => {
    if (hasVoted || voteState?.loading) return;

    setVoteState(prev => ({ ...(prev ?? { upvotes, downvotes, voted: false, error: null }), loading: true }));

    try {
      const res = await fetch(`/api/incidents/${incident.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });

      if (res.status === 409) {
        markVoted(incident.id);
        setVoteState({ upvotes, downvotes, voted: true, error: null, loading: false });
        showToast('You already voted on this report.');
        return;
      }

      if (!res.ok) throw new Error('Vote failed');

      const data = await res.json();
      markVoted(incident.id);
      setVoteState({ upvotes: data.upvotes, downvotes: data.downvotes, voted: true, error: null, loading: false });
      showToast(direction === 'UP' ? '🙏 Thanks — marked as still blocked!' : '✅ Thanks — marked as cleared!');
    } catch {
      setVoteState(prev => ({ ...(prev ?? { upvotes, downvotes, voted: false, loading: false }), error: 'Vote failed. Try again.', loading: false }));
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 mt-1">
            <div className="flex items-center gap-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold text-gray-900"
                style={{ background: meta.color }}
              >
                {meta.emoji} {meta.label}
              </span>
              {incident.is_seed && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-400 border border-gray-600">
                  Demo report
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Photo */}
          {incident.media_url && (
            <div className="rounded-xl overflow-hidden mb-4 bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={incident.media_url}
                alt="Incident photo"
                className="w-full max-h-56 object-cover"
              />
            </div>
          )}

          {/* Description */}
          {incident.description && (
            <p className="text-gray-200 text-sm leading-relaxed mb-3">
              {incident.description}
            </p>
          )}

          {/* Time */}
          <p className="text-gray-500 text-xs mb-5">
            Reported {timeAgo(incident.created_at)}
            {incident.expires_at && (
              <> · Expires {timeAgo(incident.expires_at).replace(' ago', '')}</>
            )}
          </p>

          {/* Vote section */}
          <div className="border-t border-gray-800 pt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">
              Is this still an issue?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleVote('UP')}
                disabled={hasVoted || voteState?.loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
                  bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-900/70
                  disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Still blocked"
              >
                🚫 Still Blocked
                <span className="text-xs opacity-70">({upvotes})</span>
              </button>
              <button
                onClick={() => handleVote('DOWN')}
                disabled={hasVoted || voteState?.loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
                  bg-green-900/40 text-green-300 border border-green-800 hover:bg-green-900/70
                  disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Cleared"
              >
                ✅ Cleared
                <span className="text-xs opacity-70">({downvotes})</span>
              </button>
            </div>
            {hasVoted && (
              <p className="text-center text-xs text-gray-500 mt-2">You&apos;ve voted on this report.</p>
            )}
            {voteState?.error && (
              <p className="text-center text-xs text-red-400 mt-2">{voteState.error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-gray-800 text-white px-4 py-2 rounded-full text-sm shadow-xl border border-gray-700 animate-fade-in">
          {toast}
        </div>
      )}
    </>
  );
}
