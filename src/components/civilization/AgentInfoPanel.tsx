'use client';

/**
 * Agent Info Panel - Displays current agent's info as an overlay
 * Shows character type, rank, stats, and the last decision made
 * Mini map style with cyan border
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
    <div className="absolute top-4 left-4 bg-[#0d1f35]/95 backdrop-blur-sm rounded-lg p-4 text-white min-w-[260px] border-2 border-cyan-500/70 shadow-2xl shadow-cyan-500/10">
      {/* City name header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {rankBadge && <span className="text-xl">{rankBadge}</span>}
          <h2 className="text-xl font-bold tracking-tight">{name}</h2>
        </div>
        <span className="text-xs bg-cyan-900/50 border border-cyan-700/50 px-2 py-1 rounded-full font-mono text-cyan-400">
          #{agentId + 1}
        </span>
      </div>

      {/* Character type badge - more prominent */}
      <div className="flex items-center gap-3 mb-4 bg-[#0a1628] rounded-lg px-3 py-2 border-l-4 border-cyan-500">
        <span className="text-3xl">{characterInfo.emoji}</span>
        <div>
          <div className="font-bold text-sm text-cyan-400">{characterInfo.name}</div>
          <div className="text-xs text-cyan-600">{characterInfo.description}</div>
        </div>
      </div>

      {/* Rank display */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-lg font-bold ${
            rank <= 3
              ? 'text-amber-400'
              : rank <= 10
              ? 'text-cyan-400'
              : 'text-white/80'
          }`}
        >
          Rank #{rank}
        </span>
        <span className="text-xs text-cyan-700">of 200</span>
      </div>

      {/* Stats grid - cleaner design */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div className="bg-[#0a1628] border border-cyan-900/50 rounded p-2">
          <span className="text-cyan-600 text-xs uppercase tracking-wider">Population</span>
          <div className="font-bold text-lg text-white">
            {performance.totalPopulation.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#0a1628] border border-cyan-900/50 rounded p-2">
          <span className="text-cyan-600 text-xs uppercase tracking-wider">Treasury</span>
          <div className="font-bold text-lg text-cyan-400">
            ${(performance.totalMoney / 1000).toFixed(1)}k
          </div>
        </div>
      </div>

      {/* Last Decision - more game-like */}
      <div className="pt-3 border-t border-cyan-900/50">
        <div className="text-xs text-cyan-600 mb-1 uppercase tracking-wider">Last Action</div>
        {lastDecision ? (
          <div className="bg-[#0a1628] rounded px-2 py-2 border-l-2 border-cyan-500">
            <div className="text-sm font-medium text-cyan-300">{lastDecision.action}</div>
            <div className="text-xs text-cyan-600 italic">"{lastDecision.reason}"</div>
          </div>
        ) : (
          <div className="text-xs text-cyan-700 italic">Awaiting first turn...</div>
        )}
      </div>
    </div>
  );
}

export default AgentInfoPanel;
