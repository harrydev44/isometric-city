'use client';

/**
 * Game Sidebar - Compact right panel with rankings and awards
 * Medieval/Age of Empires style with amber/gold theme
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
    <div className={`w-64 flex flex-col h-full overflow-hidden ${className}`} style={{ background: 'linear-gradient(180deg, #2d1810 0%, #1a0f0a 100%)', borderLeft: '2px solid rgba(212,175,55,0.3)' }}>
      {/* Top Rankings */}
      <div className="p-2" style={{ borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: '#D4AF37', fontFamily: 'serif' }}>
          <span className="w-1.5 h-1.5 rounded-sm" style={{ background: '#D4AF37' }} />
          Top Cities
        </h3>
        <div className="space-y-1">
          {topAgents.slice(0, 8).map((agent) => {
            const isViewing = agent.agentId === currentViewIndex;
            const characterInfo = CHARACTER_INFO[agent.personality.character];
            const rankColor =
              agent.rank === 1 ? '#FFD700' :
              agent.rank === 2 ? '#C0C0C0' :
              agent.rank === 3 ? '#CD7F32' :
              '#B8860B';

            return (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent.agentId)}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs transition-colors"
                style={{
                  background: isViewing ? 'rgba(212,175,55,0.2)' : 'transparent',
                  border: isViewing ? '1px solid rgba(212,175,55,0.4)' : '1px solid transparent',
                }}
              >
                <span className="w-4 text-right font-bold" style={{ color: rankColor }}>
                  {agent.rank}
                </span>
                <span>{characterInfo.emoji}</span>
                <span className="flex-1 truncate text-amber-100/90">{agent.name}</span>
                <span className="font-medium" style={{ color: '#D4AF37' }}>
                  {agent.performance.totalPopulation.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Awards */}
      <div className="p-2" style={{ borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: '#D4AF37', fontFamily: 'serif' }}>
          <span className="w-1.5 h-1.5 rounded-sm" style={{ background: '#D4AF37' }} />
          Awards
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {awards.map((award) => (
            <button
              key={award.id}
              onClick={() => award.winnerId !== null && onSelectAgent(award.winnerId)}
              className="rounded p-1.5 text-left transition-colors hover:opacity-80"
              style={{ background: 'rgba(139,69,19,0.3)', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              <div className="flex items-center gap-1">
                <span className="text-sm">{award.emoji}</span>
                <span className="text-[10px] text-amber-100/80 truncate">{award.name}</span>
              </div>
              <div className="text-[10px] truncate mt-0.5" style={{ color: '#B8860B' }}>
                {award.winnerName}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Character Rankings */}
      <div className="p-2 flex-1 overflow-y-auto">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: '#D4AF37', fontFamily: 'serif' }}>
          <span className="w-1.5 h-1.5 rounded-sm" style={{ background: '#D4AF37' }} />
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
                  <span className="w-3" style={{ color: '#8B6914' }}>{index + 1}</span>
                  <span>{info.emoji}</span>
                  <span className="text-amber-100/80 flex-1">{info.name}</span>
                  <span className="font-medium" style={{ color: '#D4AF37' }}>
                    {stat.avgPopulation}
                  </span>
                </div>
                <div className="ml-5 h-1.5 rounded-full overflow-hidden mt-1" style={{ background: '#3D2512', border: '1px solid rgba(139,69,19,0.5)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barWidth}%`, background: 'linear-gradient(90deg, #8B4513 0%, #D4AF37 100%)' }}
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
