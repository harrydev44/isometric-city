'use client';

/**
 * Agent Info Panel - Displays current agent's info as an overlay
 * Shows character type, rank, stats, and the last decision made
 */

import React from 'react';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface AgentInfoPanelProps {
  agent: AgentCity;
}

export function AgentInfoPanel({ agent }: AgentInfoPanelProps) {
  const { name, agentId, rank, performance, personality, lastDecision } = agent;
  const characterInfo = CHARACTER_INFO[personality.character];

  // Rank badge color
  const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white min-w-[260px] border border-white/10 shadow-2xl">
      {/* City name header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {rankBadge && <span className="text-xl">{rankBadge}</span>}
          <h2 className="text-xl font-bold tracking-tight">{name}</h2>
        </div>
        <span className="text-xs bg-white/10 px-2 py-1 rounded-full font-mono">
          #{agentId + 1}
        </span>
      </div>

      {/* Character type badge - more prominent */}
      <div className="flex items-center gap-3 mb-4 bg-gradient-to-r from-white/10 to-transparent rounded-lg px-3 py-2 border-l-4 border-cyan-500">
        <span className="text-3xl">{characterInfo.emoji}</span>
        <div>
          <div className="font-bold text-sm text-cyan-400">{characterInfo.name}</div>
          <div className="text-xs text-white/60">{characterInfo.description}</div>
        </div>
      </div>

      {/* Rank display */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-lg font-bold ${
            rank <= 3
              ? 'text-yellow-400'
              : rank <= 10
              ? 'text-cyan-400'
              : 'text-white/80'
          }`}
        >
          Rank #{rank}
        </span>
        <span className="text-xs text-white/40">of 200</span>
      </div>

      {/* Stats grid - cleaner design */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div className="bg-white/5 rounded p-2">
          <span className="text-white/40 text-xs uppercase tracking-wider">Population</span>
          <div className="font-bold text-lg text-white">
            {performance.totalPopulation.toLocaleString()}
          </div>
        </div>
        <div className="bg-white/5 rounded p-2">
          <span className="text-white/40 text-xs uppercase tracking-wider">Treasury</span>
          <div className="font-bold text-lg text-green-400">
            ${(performance.totalMoney / 1000).toFixed(1)}k
          </div>
        </div>
      </div>

      {/* Last Decision - more game-like */}
      <div className="pt-3 border-t border-white/10">
        <div className="text-xs text-white/40 mb-1 uppercase tracking-wider">Last Action</div>
        {lastDecision ? (
          <div className="bg-gradient-to-r from-blue-900/30 to-transparent rounded px-2 py-2 border-l-2 border-blue-500">
            <div className="text-sm font-medium text-blue-300">{lastDecision.action}</div>
            <div className="text-xs text-white/50 italic">"{lastDecision.reason}"</div>
          </div>
        ) : (
          <div className="text-xs text-white/30 italic">Awaiting first turn...</div>
        )}
      </div>
    </div>
  );
}

export default AgentInfoPanel;
