'use client';

/**
 * Game Top Bar - Strategy game style top bar with turn info and stats
 */

import React from 'react';
import { TurnPhase, CIVILIZATION_CONSTANTS } from '@/types/civilization';
import { CivilizationStats } from '@/lib/turnManager';

interface GameTopBarProps {
  currentTurn: number;
  turnPhase: TurnPhase;
  timeRemaining: number;
  processingProgress: number;
  autoAdvance: boolean;
  speedMultiplier: number;
  stats: CivilizationStats;
  onToggleAutoAdvance: () => void;
  onAdvanceTurn: () => void;
  onSpeedChange: (speed: number) => void;
  onExit: () => void;
}

export function GameTopBar({
  currentTurn,
  turnPhase,
  timeRemaining,
  processingProgress,
  autoAdvance,
  speedMultiplier,
  stats,
  onToggleAutoAdvance,
  onAdvanceTurn,
  onSpeedChange,
  onExit,
}: GameTopBarProps) {
  const secondsRemaining = Math.ceil(timeRemaining / 1000);

  return (
    <div className="h-12 bg-gradient-to-b from-slate-800 to-slate-900 border-b-2 border-slate-600 flex items-center justify-between px-2 shadow-lg">
      {/* Left section - Turn info */}
      <div className="flex items-center gap-2">
        {/* Turn counter - styled like game UI */}
        <div className="flex items-center bg-slate-700/80 border border-slate-500 rounded px-3 py-1">
          <span className="text-amber-400 font-bold text-lg mr-2">Turn</span>
          <span className="text-white font-bold text-xl tabular-nums">{currentTurn}</span>
        </div>

        {/* Turn status */}
        <div className="flex items-center bg-slate-700/80 border border-slate-500 rounded px-3 py-1 min-w-[140px]">
          {turnPhase === 'thinking' ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-amber-400 text-sm font-medium">
                Processing {processingProgress}%
              </span>
            </div>
          ) : autoAdvance ? (
            <span className="text-slate-300 text-sm">
              Next: <span className="text-white font-bold">{secondsRemaining}s</span>
            </span>
          ) : (
            <span className="text-slate-400 text-sm">Paused</span>
          )}
        </div>

        {/* Speed controls */}
        <div className="flex items-center bg-slate-700/80 border border-slate-500 rounded overflow-hidden">
          {CIVILIZATION_CONSTANTS.SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={`px-2 py-1 text-xs font-bold transition-colors ${
                speedMultiplier === speed
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-600'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Play/Pause button */}
        <button
          onClick={onToggleAutoAdvance}
          className={`px-3 py-1 rounded font-bold text-sm transition-colors border ${
            autoAdvance
              ? 'bg-green-700/50 border-green-500 text-green-300 hover:bg-green-700'
              : 'bg-slate-700/50 border-slate-500 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {autoAdvance ? '▶ AUTO' : '⏸ PAUSED'}
        </button>

        {!autoAdvance && turnPhase === 'idle' && (
          <button
            onClick={onAdvanceTurn}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 border border-amber-400 rounded font-bold text-sm text-white transition-colors"
          >
            NEXT →
          </button>
        )}
      </div>

      {/* Center section - Global stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-700/60 border border-slate-500 rounded px-3 py-1">
          <span className="text-slate-400 text-xs">POPULATION</span>
          <span className="text-cyan-400 font-bold ml-2">{stats.totalPopulation.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-700/60 border border-slate-500 rounded px-3 py-1">
          <span className="text-slate-400 text-xs">CITIES</span>
          <span className="text-white font-bold ml-2">200</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-700/60 border border-slate-500 rounded px-3 py-1">
          <span className="text-slate-400 text-xs">BUILDINGS</span>
          <span className="text-amber-400 font-bold ml-2">{stats.totalBuildingsPlaced.toLocaleString()}</span>
        </div>
      </div>

      {/* Right section - Exit */}
      <button
        onClick={onExit}
        className="px-4 py-1 bg-red-900/50 hover:bg-red-800 border border-red-700 rounded font-bold text-sm text-red-300 transition-colors"
      >
        EXIT
      </button>
    </div>
  );
}

export default GameTopBar;
