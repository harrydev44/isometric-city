'use client';

/**
 * Game Sidebar - Compact right panel with rankings and awards
 * Strategy game style
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
}

export function GameSidebar({
  topAgents,
  awards,
  characterStats,
  currentViewIndex,
  onSelectAgent,
}: GameSidebarProps) {
  return (
    <div className="w-64 bg-slate-900/95 border-l-2 border-slate-600 flex flex-col h-full overflow-hidden">
      {/* Top Rankings */}
      <div className="p-2 border-b border-slate-700">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          🏆 Top Cities
        </h3>
        <div className="space-y-1">
          {topAgents.slice(0, 8).map((agent) => {
            const isViewing = agent.agentId === currentViewIndex;
            const characterInfo = CHARACTER_INFO[agent.personality.character];
            const rankColor =
              agent.rank === 1 ? 'text-yellow-400' :
              agent.rank === 2 ? 'text-slate-300' :
              agent.rank === 3 ? 'text-amber-600' :
              'text-slate-500';

            return (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent.agentId)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs
                  transition-colors
                  ${isViewing
                    ? 'bg-blue-600/30 border border-blue-500/50'
                    : 'hover:bg-slate-800'
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
      <div className="p-2 border-b border-slate-700">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          🎖️ Awards
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {awards.map((award) => (
            <button
              key={award.id}
              onClick={() => award.winnerId !== null && onSelectAgent(award.winnerId)}
              className="bg-slate-800/60 hover:bg-slate-800 rounded p-1.5 text-left transition-colors"
            >
              <div className="flex items-center gap-1">
                <span className="text-sm">{award.emoji}</span>
                <span className="text-[10px] text-white/80 truncate">{award.name}</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {award.winnerName}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Character Rankings */}
      <div className="p-2 flex-1 overflow-y-auto">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          📊 Character Types
        </h3>
        <div className="space-y-2">
          {characterStats.map((stat, index) => {
            const info = CHARACTER_INFO[stat.character];
            const maxPop = characterStats[0]?.avgPopulation || 1;
            const barWidth = (stat.avgPopulation / maxPop) * 100;

            return (
              <div key={stat.character}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 w-3">{index + 1}</span>
                  <span>{info.emoji}</span>
                  <span className="text-white/80 flex-1">{info.name}</span>
                  <span className="text-cyan-400 font-medium">
                    {stat.avgPopulation}
                  </span>
                </div>
                <div className="ml-5 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
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
