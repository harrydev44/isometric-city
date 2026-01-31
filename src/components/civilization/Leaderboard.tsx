'use client';

/**
 * Leaderboard - Shows top agents by population
 */

import React from 'react';
import { AgentCity } from '@/types/civilization';

interface LeaderboardProps {
  agents: AgentCity[];
  currentViewIndex: number;
  onSelectAgent: (index: number) => void;
}

export function Leaderboard({ agents, currentViewIndex, onSelectAgent }: LeaderboardProps) {
  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white w-64">
      <h3 className="text-sm font-bold mb-2 text-white/80">Leaderboard</h3>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {agents.map((agent, index) => {
          const isCurrentView = agent.agentId === currentViewIndex;
          const rankColor =
            agent.rank === 1
              ? 'text-yellow-400'
              : agent.rank === 2
              ? 'text-gray-300'
              : agent.rank === 3
              ? 'text-amber-600'
              : 'text-white/60';

          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.agentId)}
              className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm transition-colors ${
                isCurrentView
                  ? 'bg-blue-500/30 border border-blue-400/50'
                  : 'hover:bg-white/10'
              }`}
            >
              <span className={`w-6 text-right font-bold ${rankColor}`}>
                {agent.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{agent.name}</div>
                <div className="text-xs text-white/50">
                  {agent.performance.totalPopulation.toLocaleString()} pop
                </div>
              </div>
              {agent.rank <= 3 && (
                <span className="text-lg">
                  {agent.rank === 1 ? '🥇' : agent.rank === 2 ? '🥈' : '🥉'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Leaderboard;
