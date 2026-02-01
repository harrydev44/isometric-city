'use client';

/**
 * Game Top Bar - Strategy game style top bar with turn info and stats
 * Cyan/teal theme
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
    <div className="h-12 bg-gradient-to-b from-[#0d1f35] to-[#0a1628] border-b-2 border-cyan-700/50 flex items-center justify-between px-2 shadow-lg">
      {/* Left section - Turn info */}
      <div className="flex items-center gap-2">
        {/* Turn counter - styled like game UI */}
        <div className="flex items-center bg-[#0d1f35] border border-cyan-600/50 rounded px-3 py-1">
          <span className="text-cyan-400 font-bold text-lg mr-2">Turn</span>
          <span className="text-white font-bold text-xl tabular-nums">{currentTurn}</span>
        </div>

        {/* Turn status */}
        <div className="flex items-center bg-[#0d1f35] border border-cyan-600/50 rounded px-3 py-1 min-w-[140px]">
          {turnPhase === 'thinking' ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-cyan-400 text-sm font-medium">
                Processing {processingProgress}%
              </span>
            </div>
          ) : (
            <span className="text-cyan-300/70 text-sm">
              Next: <span className="text-white font-bold">{secondsRemaining}s</span>
            </span>
          )}
        </div>

        {/* Speed controls - only for leaders */}
        {isLeader && (
          <div className="flex items-center bg-[#0d1f35] border border-cyan-600/50 rounded overflow-hidden">
            {CIVILIZATION_CONSTANTS.SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-1 text-xs font-bold transition-colors ${
                  speedMultiplier === speed
                    ? 'bg-cyan-600 text-white'
                    : 'text-cyan-500/70 hover:text-white hover:bg-cyan-800/50'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Center section - Global stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 bg-[#0d1f35]/60 border border-cyan-700/40 rounded px-3 py-1">
          <span className="text-cyan-600 text-xs">POPULATION</span>
          <span className="text-cyan-400 font-bold ml-2">{stats.totalPopulation.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 bg-[#0d1f35]/60 border border-cyan-700/40 rounded px-3 py-1">
          <span className="text-cyan-600 text-xs">CITIES</span>
          <span className="text-white font-bold ml-2">200</span>
        </div>
        <div className="flex items-center gap-1 bg-[#0d1f35]/60 border border-cyan-700/40 rounded px-3 py-1">
          <span className="text-cyan-600 text-xs">BUILDINGS</span>
          <span className="text-cyan-400 font-bold ml-2">{stats.totalBuildingsPlaced.toLocaleString()}</span>
        </div>

        {/* Connection status and viewer count */}
        <div className="flex items-center gap-2 bg-[#0d1f35]/60 border border-cyan-700/40 rounded px-3 py-1">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-cyan-400' : 'bg-red-500'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
          <span className="text-cyan-300/70 text-xs">
            {viewerCount} watching
          </span>
          {isLeader && (
            <span className="text-cyan-400 text-xs font-bold">(Host)</span>
          )}
        </div>
      </div>

      {/* Right section - Agents link + Exit */}
      <div className="flex items-center gap-2">
        <a
          href="/agents"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1 bg-cyan-900/50 hover:bg-cyan-800 border border-cyan-700 rounded font-bold text-sm text-cyan-300 transition-colors"
        >
          🤖 AGENTS
        </a>
        <button
          onClick={onExit}
          className="px-4 py-1 bg-red-900/50 hover:bg-red-800 border border-red-700 rounded font-bold text-sm text-red-300 transition-colors"
        >
          EXIT
        </button>
      </div>
    </div>
  );
}

export default GameTopBar;
