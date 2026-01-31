'use client';

/**
 * Turn Progress - Shows turn counter, timer, and processing progress
 */

import React from 'react';
import { TurnPhase, CIVILIZATION_CONSTANTS } from '@/types/civilization';

const { TURN_DURATION_MS } = CIVILIZATION_CONSTANTS;

interface TurnProgressProps {
  currentTurn: number;
  turnPhase: TurnPhase;
  timeRemaining: number;
  processingProgress: number;
  autoAdvance: boolean;
  onToggleAutoAdvance: () => void;
  onAdvanceTurn: () => void;
}

export function TurnProgress({
  currentTurn,
  turnPhase,
  timeRemaining,
  processingProgress,
  autoAdvance,
  onToggleAutoAdvance,
  onAdvanceTurn,
}: TurnProgressProps) {
  const progressPercent = ((TURN_DURATION_MS - timeRemaining) / TURN_DURATION_MS) * 100;
  const secondsRemaining = Math.ceil(timeRemaining / 1000);

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">Turn {currentTurn}</span>
          {turnPhase === 'thinking' && (
            <span className="text-xs text-yellow-400 animate-pulse">
              Processing... {processingProgress}%
            </span>
          )}
          {turnPhase === 'idle' && autoAdvance && (
            <span className="text-xs text-white/50">
              Next turn in {secondsRemaining}s
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleAutoAdvance}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              autoAdvance
                ? 'bg-green-500/30 text-green-300'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Auto {autoAdvance ? 'ON' : 'OFF'}
          </button>

          {!autoAdvance && turnPhase === 'idle' && (
            <button
              onClick={onAdvanceTurn}
              className="text-xs px-3 py-1 bg-blue-500/30 text-blue-300 rounded hover:bg-blue-500/50 transition-colors"
            >
              Next Turn
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        {turnPhase === 'thinking' ? (
          <div
            className="h-full bg-yellow-400 transition-all duration-100"
            style={{ width: `${processingProgress}%` }}
          />
        ) : (
          <div
            className="h-full bg-blue-400 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default TurnProgress;
