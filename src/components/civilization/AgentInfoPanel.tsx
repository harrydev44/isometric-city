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

  return (
    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-4 text-white min-w-[240px]">
      {/* City name and agent number */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">{name}</h2>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
          #{agentId + 1}
        </span>
      </div>

      {/* Character type badge */}
      <div className="flex items-center gap-2 mb-3 bg-white/10 rounded-lg px-3 py-2">
        <span className="text-2xl">{characterInfo.emoji}</span>
        <div>
          <div className="font-medium text-sm">{characterInfo.name}</div>
          <div className="text-xs text-white/50">{characterInfo.description}</div>
        </div>
      </div>

      {/* Rank */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-sm font-medium ${
            rank <= 3
              ? 'text-yellow-400'
              : rank <= 10
              ? 'text-blue-400'
              : 'text-white/70'
          }`}
        >
          Rank #{rank}
        </span>
        <span className="text-xs text-white/50">of 200</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-white/50 text-xs">Population</span>
          <div className="font-medium">
            {performance.totalPopulation.toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-white/50 text-xs">Money</span>
          <div className="font-medium text-green-400">
            ${performance.totalMoney.toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-white/50 text-xs">Peak Pop</span>
          <div className="font-medium">
            {performance.peakPopulation.toLocaleString()}
          </div>
        </div>
        <div>
          <span className="text-white/50 text-xs">Buildings</span>
          <div className="font-medium">{performance.buildingsPlaced}</div>
        </div>
      </div>

      {/* Last Decision */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-xs text-white/50 mb-1">Last Turn Decision</div>
        {lastDecision ? (
          <div className="bg-white/5 rounded px-2 py-1.5">
            <div className="text-sm font-medium">{lastDecision.action}</div>
            <div className="text-xs text-white/50 italic">{lastDecision.reason}</div>
          </div>
        ) : (
          <div className="text-xs text-white/30 italic">Waiting for first turn...</div>
        )}
      </div>
    </div>
  );
}

export default AgentInfoPanel;
