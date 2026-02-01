'use client';

/**
 * Turn Progress - Shows turn counter, timer, speed control, and processing progress
 */

import React from 'react';
import { TurnPhase, CIVILIZATION_CONSTANTS } from '@/types/civilization';
import { SpeedControl } from './SpeedControl';

const { TURN_DURATION_MS } = CIVILIZATION_CONSTANTS;

interface TurnProgressProps {
  currentTurn: number;
  turnPhase: TurnPhase;
  timeRemaining: number;
  processingProgress: number;
  autoAdvance: boolean;
  speedMultiplier: number;
  onToggleAutoAdvance: () => void;
  onAdvanceTurn: () => void;
  onSpeedChange: (speed: number) => void;
}

export function TurnProgress({
  currentTurn,
  turnPhase,
  timeRemaining,
  processingProgress,
  autoAdvance,
  speedMultiplier,
  onToggleAutoAdvance,
  onAdvanceTurn,
  onSpeedChange,
}: TurnProgressProps) {
  const effectiveDuration = TURN_DURATION_MS / speedMultiplier;
  const progressPercent = ((effectiveDuration - timeRemaining) / effectiveDuration) * 100;
  const secondsRemaining = Math.ceil(timeRemaining / 1000);

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white flex-1">
      <div className="flex items-center justify-between mb-2">
        {/* Turn counter - more prominent */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">Turn {currentTurn}</span>
            <span className="text-white/40">/ ∞</span>
          </div>

          {turnPhase === 'thinking' && (
            <div className="flex items-center gap-2 text-yellow-400 animate-pulse">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
              <span className="text-sm font-medium">
                Processing {processingProgress}%
              </span>
            </div>
          )}

          {turnPhase === 'idle' && autoAdvance && (
            <div className="flex items-center gap-2 text-white/60">
              <div className="w-2 h-2 bg-amber-400 rounded-full" />
              <span className="text-sm">
                {secondsRemaining}s until next turn
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Speed control */}
          <SpeedControl
            currentSpeed={speedMultiplier}
            onSpeedChange={onSpeedChange}
          />

          <button
            onClick={onToggleAutoAdvance}
            className={`text-xs px-3 py-1.5 rounded transition-colors font-medium ${
              autoAdvance
                ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                : 'bg-white/10 text-white/60 hover:bg-white/20 border border-white/20'
            }`}
          >
            Auto {autoAdvance ? 'ON' : 'OFF'}
          </button>

          {!autoAdvance && turnPhase === 'idle' && (
            <button
              onClick={onAdvanceTurn}
              className="text-xs px-4 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors font-medium"
            >
              Next Turn →
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        {turnPhase === 'thinking' ? (
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-100"
            style={{ width: `${processingProgress}%` }}
          />
        ) : (
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default TurnProgress;
