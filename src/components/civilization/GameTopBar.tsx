'use client';

/**
 * Game Top Bar - Age of the Claw style top bar with turn info and stats
 * Orange/red crab theme
 */

import React from 'react';
import { TurnPhase, CIVILIZATION_CONSTANTS } from '@/types/civilization';
import { CivilizationStats } from '@/lib/turnManager';

interface GameTopBarProps {
  currentTurn: number;
  turnPhase: TurnPhase;
  timeRemaining: number;
  processingProgress: number;
  speedMultiplier: number;
  stats: CivilizationStats;
  isLeader: boolean;
  isConnected: boolean;
  viewerCount: number;
  onSpeedChange: (speed: number) => void;
  onExit: () => void;
}

export function GameTopBar({
  currentTurn,
  turnPhase,
  timeRemaining,
  processingProgress,
  speedMultiplier,
  stats,
  isLeader,
  isConnected,
  viewerCount,
  onSpeedChange,
  onExit,
}: GameTopBarProps) {
  const secondsRemaining = Math.ceil(timeRemaining / 1000);

  return (
    <div className="h-14 bg-gradient-to-b from-[#1a0a05] to-[#0d0805] border-b-2 border-orange-700/50 flex items-center justify-between px-3 shadow-lg">
      {/* Left section - Logo and Turn info */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🦀</span>
          <span className="text-orange-400 font-bold text-sm hidden sm:block">Age of the Claw</span>
        </div>

        {/* Turn counter */}
        <div className="flex items-center bg-[#1a0a05] border border-orange-600/50 rounded px-3 py-1">
          <span className="text-orange-400 font-bold text-sm mr-2">Turn</span>
          <span className="text-white font-bold text-xl tabular-nums">{currentTurn}</span>
        </div>

        {/* Turn status */}
        <div className="flex items-center bg-[#1a0a05] border border-orange-600/50 rounded px-3 py-1 min-w-[120px]">
          {turnPhase === 'thinking' ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              <span className="text-orange-400 text-sm font-medium">
                {processingProgress}%
              </span>
            </div>
          ) : (
            <span className="text-orange-300/70 text-sm">
              Next: <span className="text-white font-bold">{secondsRemaining}s</span>
            </span>
          )}
        </div>

        {/* Speed controls - only for leaders */}
        {isLeader && (
          <div className="flex items-center bg-[#1a0a05] border border-orange-600/50 rounded overflow-hidden">
            {CIVILIZATION_CONSTANTS.SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-1 text-xs font-bold transition-colors ${
                  speedMultiplier === speed
                    ? 'bg-orange-600 text-white'
                    : 'text-orange-500/70 hover:text-white hover:bg-orange-800/50'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center section - Global stats */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-[#1a0a05]/60 border border-orange-700/40 rounded px-3 py-1">
          <span className="text-orange-600 text-xs">POP</span>
          <span className="text-orange-400 font-bold ml-1">{stats.totalPopulation.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 bg-[#1a0a05]/60 border border-orange-700/40 rounded px-3 py-1">
          <span className="text-orange-600 text-xs">🦀</span>
          <span className="text-white font-bold ml-1">200</span>
        </div>
        <div className="flex items-center gap-1 bg-[#1a0a05]/60 border border-orange-700/40 rounded px-3 py-1">
          <span className="text-orange-600 text-xs">BLDG</span>
          <span className="text-orange-400 font-bold ml-1">{stats.totalBuildingsPlaced.toLocaleString()}</span>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 bg-[#1a0a05]/60 border border-orange-700/40 rounded px-3 py-1">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-orange-300/70 text-xs">
            {viewerCount}
          </span>
          {isLeader && (
            <span className="text-orange-400 text-xs font-bold">HOST</span>
          )}
        </div>
      </div>

      {/* Right section - Links + Exit */}
      <div className="flex items-center gap-2">
        <a
          href="https://pump.fun/coin/3TEMWbJ4bZxVnc7SmiNypm5dQTfcXhuTRv1yPQXKpump"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-green-900/50 hover:bg-green-800 border border-green-600 rounded font-bold text-xs text-green-300 transition-colors"
        >
          💎 $AOTC
        </a>
        <a
          href="/agents"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-orange-900/50 hover:bg-orange-800 border border-orange-600 rounded font-bold text-xs text-orange-300 transition-colors"
        >
          🦀 CLAWBOTS
        </a>
        <button
          onClick={onExit}
          className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 border border-red-700 rounded font-bold text-xs text-red-300 transition-colors"
        >
          EXIT
        </button>
      </div>
    </div>
  );
}

export default GameTopBar;
