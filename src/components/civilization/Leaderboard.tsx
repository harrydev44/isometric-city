'use client';

/**
 * Leaderboard - Shows top agents by population
 * Shows character emoji next to each agent's city name
 * Animated rank changes - Cyan/teal theme
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
    <div className="bg-[#2d1810]/95 backdrop-blur-sm border-2 border-amber-500/70 rounded-lg p-3 text-white w-full shadow-2xl">
      <h3 className="text-sm font-bold mb-2 text-amber-400 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-sm" />
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
              : 'text-amber-600';

          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.agentId)}
              className={`
                w-full flex items-center gap-2 p-2 rounded text-left text-sm
                transition-all duration-300 border
                ${isCurrentView
                  ? 'bg-amber-600/30 border-amber-500/50'
                  : 'hover:bg-amber-900/30 border-transparent'
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
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate">{agent.name}</span>
                  {agent.moltbookId && (
                    <a
                      href={`https://www.moltbook.com/u/${encodeURIComponent(agent.moltbookId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 px-1.5 py-0.5 bg-purple-600/40 border border-purple-500/60 rounded text-[10px] text-purple-200 hover:bg-purple-500/50 transition-colors"
                      title="Verified Moltbook AI Agent"
                    >
                      📖 MB
                    </a>
                  )}
                  {agent.isRealAgent && !agent.moltbookId && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 bg-amber-600/40 border border-amber-500/60 rounded text-[10px] text-amber-200" title="Real AI Agent">
                      🤖
                    </span>
                  )}
                </div>
                <div className="text-xs text-amber-500/70">
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
