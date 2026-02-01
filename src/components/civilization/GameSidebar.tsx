'use client';

/**
 * Game Sidebar - Compact right panel with rankings and awards
 * Strategy game style with cyan/teal theme
 */

import React from 'react';
import { AgentCity, CHARACTER_INFO, CharacterAward } from '@/types/civilization';
import { CharacterStats } from '@/lib/turnManager';

interface GameSidebarProps {
  topAgents: AgentCity[];
  awards: CharacterAward[];
  characterStats: CharacterStats[];
  currentViewIndex: number;
  onSelectAgent: (agentId: number) => void;
  className?: string;
}

export function GameSidebar({
  topAgents,
  awards,
  characterStats,
  currentViewIndex,
  onSelectAgent,
  className = '',
}: GameSidebarProps) {
  return (
    <div className={`w-64 bg-[#0d1f35]/95 border-l-2 border-cyan-700/50 flex flex-col h-full overflow-hidden ${className}`}>
      {/* Top Rankings */}
      <div className="p-2 border-b border-cyan-900/50">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
          Top Cities
        </h3>
        <div className="space-y-1">
          {topAgents.slice(0, 8).map((agent) => {
            const isViewing = agent.agentId === currentViewIndex;
            const characterInfo = CHARACTER_INFO[agent.personality.character];
            const rankColor =
              agent.rank === 1 ? 'text-yellow-400' :
              agent.rank === 2 ? 'text-slate-300' :
              agent.rank === 3 ? 'text-amber-600' :
              'text-cyan-600';

            return (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent.agentId)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs
                  transition-colors
                  ${isViewing
                    ? 'bg-cyan-600/30 border border-cyan-500/50'
                    : 'hover:bg-cyan-900/30 border border-transparent'
                  }
                `}
              >
                <span className={`w-4 text-right font-bold ${rankColor}`}>
                  {agent.rank}
                </span>
                <span>{characterInfo.emoji}</span>
                <span className="flex-1 truncate text-white/90">{agent.name}</span>
                <span className="text-cyan-400 font-medium">
                  {agent.performance.totalPopulation.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Awards */}
      <div className="p-2 border-b border-cyan-900/50">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
          Awards
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {awards.map((award) => (
            <button
              key={award.id}
              onClick={() => award.winnerId !== null && onSelectAgent(award.winnerId)}
              className="bg-[#0a1628] hover:bg-cyan-900/30 border border-cyan-900/50 rounded p-1.5 text-left transition-colors"
            >
              <div className="flex items-center gap-1">
                <span className="text-sm">{award.emoji}</span>
                <span className="text-[10px] text-white/80 truncate">{award.name}</span>
              </div>
              <div className="text-[10px] text-cyan-500/70 truncate mt-0.5">
                {award.winnerName}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Character Rankings */}
      <div className="p-2 flex-1 overflow-y-auto">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
          Character Types
        </h3>
        <div className="space-y-2">
          {characterStats.map((stat, index) => {
            const info = CHARACTER_INFO[stat.character];
            const maxPop = characterStats[0]?.avgPopulation || 1;
            const barWidth = (stat.avgPopulation / maxPop) * 100;

            return (
              <div key={stat.character}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-cyan-600 w-3">{index + 1}</span>
                  <span>{info.emoji}</span>
                  <span className="text-white/80 flex-1">{info.name}</span>
                  <span className="text-cyan-400 font-medium">
                    {stat.avgPopulation}
                  </span>
                </div>
                <div className="ml-5 h-1.5 bg-[#0a1628] rounded-full overflow-hidden mt-1 border border-cyan-900/30">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GameSidebar;
