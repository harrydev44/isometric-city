'use client';

/**
 * Leaderboard - Shows top agents by population
 * Shows character emoji next to each agent's city name
 * Animated rank changes
 */

import React, { useRef, useEffect, useState } from 'react';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface LeaderboardProps {
  agents: AgentCity[];
  currentViewIndex: number;
  onSelectAgent: (index: number) => void;
}

interface RankChange {
  agentId: number;
  direction: 'up' | 'down' | 'none';
}

export function Leaderboard({ agents, currentViewIndex, onSelectAgent }: LeaderboardProps) {
  const [rankChanges, setRankChanges] = useState<Map<number, RankChange>>(new Map());
  const prevRanksRef = useRef<Map<number, number>>(new Map());

  // Track rank changes
  useEffect(() => {
    const newChanges = new Map<number, RankChange>();
    const currentRanks = new Map<number, number>();

    agents.forEach(agent => {
      currentRanks.set(agent.agentId, agent.rank);
      const prevRank = prevRanksRef.current.get(agent.agentId);

      if (prevRank !== undefined && prevRank !== agent.rank) {
        newChanges.set(agent.agentId, {
          agentId: agent.agentId,
          direction: agent.rank < prevRank ? 'up' : 'down',
        });
      }
    });

    setRankChanges(newChanges);
    prevRanksRef.current = currentRanks;

    // Clear changes after animation
    const timer = setTimeout(() => {
      setRankChanges(new Map());
    }, 2000);

    return () => clearTimeout(timer);
  }, [agents]);

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white w-full">
      <h3 className="text-sm font-bold mb-2 text-white/80 flex items-center gap-2">
        <span>🏆</span>
        Leaderboard
      </h3>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {agents.map((agent) => {
          const isCurrentView = agent.agentId === currentViewIndex;
          const rankChange = rankChanges.get(agent.agentId);
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
              className={`
                w-full flex items-center gap-2 p-2 rounded text-left text-sm
                transition-all duration-300
                ${isCurrentView
                  ? 'bg-blue-500/30 border border-blue-400/50'
                  : 'hover:bg-white/10'
                }
                ${rankChange?.direction === 'up' ? 'animate-pulse bg-green-500/20' : ''}
                ${rankChange?.direction === 'down' ? 'animate-pulse bg-red-500/20' : ''}
              `}
            >
              <span className={`w-6 text-right font-bold ${rankColor}`}>
                {agent.rank}
              </span>

              {/* Rank change indicator */}
              <span className="w-3 text-xs">
                {rankChange?.direction === 'up' && <span className="text-green-400">▲</span>}
                {rankChange?.direction === 'down' && <span className="text-red-400">▼</span>}
              </span>

              <span className="text-base" title={CHARACTER_INFO[agent.personality.character].name}>
                {CHARACTER_INFO[agent.personality.character].emoji}
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
