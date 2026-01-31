'use client';

/**
 * Agent Info Panel - Displays current agent's info as an overlay
 */

import React from 'react';
import { AgentCity } from '@/types/civilization';

interface AgentInfoPanelProps {
  agent: AgentCity;
}

export function AgentInfoPanel({ agent }: AgentInfoPanelProps) {
  const { name, agentId, rank, performance, personality } = agent;

  return (
    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-4 text-white min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">{name}</h2>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
          #{agentId + 1}
        </span>
      </div>

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

      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-xs text-white/50 mb-1">Personality</div>
        <div className="flex flex-wrap gap-1">
          {personality.aggressiveness > 0.6 && (
            <span className="text-xs bg-red-500/30 px-1.5 py-0.5 rounded">
              Aggressive
            </span>
          )}
          {personality.industrialFocus > 0.6 && (
            <span className="text-xs bg-orange-500/30 px-1.5 py-0.5 rounded">
              Industrial
            </span>
          )}
          {personality.densityPreference > 0.6 && (
            <span className="text-xs bg-purple-500/30 px-1.5 py-0.5 rounded">
              Dense
            </span>
          )}
          {personality.environmentFocus > 0.6 && (
            <span className="text-xs bg-green-500/30 px-1.5 py-0.5 rounded">
              Green
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentInfoPanel;
