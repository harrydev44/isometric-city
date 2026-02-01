'use client';

/**
 * Leader Panel - Shows a city leader in strategy game style
 * Displays at bottom left/right like faction leaders
 * Cyan/teal theme with character color accents
 */

import React from 'react';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface LeaderPanelProps {
  agent: AgentCity;
  side: 'left' | 'right';
  isViewing?: boolean;
  onClick?: () => void;
}

// Character-specific colors for the panel accent
const CHARACTER_COLORS: Record<string, { border: string; text: string; glow: string }> = {
  industrialist: { border: 'border-orange-500', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
  environmentalist: { border: 'border-green-500', text: 'text-green-400', glow: 'shadow-green-500/20' },
  capitalist: { border: 'border-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' },
  expansionist: { border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  planner: { border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  gambler: { border: 'border-red-500', text: 'text-red-400', glow: 'shadow-red-500/20' },
};

export function LeaderPanel({ agent, side, isViewing = false, onClick }: LeaderPanelProps) {
  const { name, rank, performance, personality, lastDecision } = agent;
  const characterInfo = CHARACTER_INFO[personality.character];
  const colors = CHARACTER_COLORS[personality.character];

  const rankMedal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  // Use cyan border for current city, character color for leader
  const borderColor = isViewing ? 'border-cyan-500' : colors.border;
  const glowEffect = isViewing ? 'shadow-cyan-500/30' : colors.glow;

  return (
    <div
      onClick={onClick}
      className={`
        w-72 bg-[#0d1f35]/95 backdrop-blur-sm
        border-2 ${borderColor} ${isViewing ? 'ring-1 ring-cyan-400/30' : ''}
        rounded-t-lg shadow-2xl ${glowEffect} cursor-pointer
        transition-all hover:scale-[1.02]
        ${side === 'left' ? 'rounded-tr-none' : 'rounded-tl-none'}
      `}
    >
      {/* Rank badge */}
      <div className={`
        absolute -top-3 ${side === 'left' ? 'left-3' : 'right-3'}
        bg-[#0a1628] border ${borderColor} rounded px-2 py-0.5
        text-xs font-bold ${isViewing ? 'text-cyan-400' : colors.text}
      `}>
        #{rank} {rankMedal}
      </div>

      {/* Main content */}
      <div className="p-3 pt-4">
        {/* Character portrait area */}
        <div className="flex items-start gap-3">
          {/* Large emoji as "portrait" - 64x64 */}
          <div className={`
            w-16 h-16 bg-[#0a1628] border-2 ${borderColor}
            rounded flex items-center justify-center text-4xl
            shadow-inner
          `}>
            {characterInfo.emoji}
          </div>

          {/* Name and character type */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm truncate">{name}</h3>
            <div className="text-cyan-400 text-xs font-medium">
              {characterInfo.name}
            </div>
            {/* Moltbook badge - prominent display */}
            {agent.moltbookId && (
              <a
                href={`https://www.moltbook.com/${encodeURIComponent(agent.moltbookId)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-gradient-to-r from-purple-700/60 to-pink-700/60 border border-purple-400/60 rounded-full text-[10px] text-purple-100 hover:from-purple-600 hover:to-pink-600 transition-colors shadow-sm"
                title="Verified Moltbook AI Agent - Click to view profile"
              >
                📖 <span className="font-medium">Moltbook Verified</span>
              </a>
            )}
            {agent.isRealAgent && !agent.moltbookId && (
              <span
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-cyan-700/50 border border-cyan-500/60 rounded-full text-[10px] text-cyan-200"
                title="Real AI Agent"
              >
                🤖 <span className="font-medium">AI Agent</span>
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Population */}
          <div className="bg-[#0a1628] rounded px-2 py-1 border border-cyan-900/50">
            <div className="text-cyan-600 text-[10px] uppercase">Population</div>
            <div className="text-white font-bold text-lg">
              {performance.totalPopulation.toLocaleString()}
            </div>
          </div>

          {/* Treasury */}
          <div className="bg-[#0a1628] rounded px-2 py-1 border border-cyan-900/50">
            <div className="text-cyan-600 text-[10px] uppercase">Treasury</div>
            <div className="text-cyan-400 font-bold text-lg">
              ${(performance.totalMoney / 1000).toFixed(1)}k
            </div>
          </div>
        </div>

        {/* Global Influence style score */}
        <div className={`
          mt-2 bg-[#0a1628] border ${borderColor}
          rounded px-3 py-2 text-center
        `}>
          <div className="text-cyan-600 text-[10px] uppercase tracking-wider">
            Total Score
          </div>
          <div className="text-amber-400 font-bold text-2xl">
            {(performance.totalPopulation + performance.buildingsPlaced * 10).toLocaleString()}
          </div>
        </div>

        {/* Last action */}
        {lastDecision && (
          <div className="mt-2 bg-[#0a1628]/60 rounded px-2 py-1.5 border-l-2 border-cyan-600">
            <div className="text-cyan-600 text-[10px] uppercase">Last Action</div>
            <div className="text-cyan-300 text-xs font-medium truncate">
              {lastDecision.action}
            </div>
          </div>
        )}
      </div>

      {/* Panel label */}
      <div className={`
        text-center py-1.5 text-xs font-medium border-t
        ${isViewing
          ? 'bg-cyan-900/50 text-cyan-300 border-cyan-700'
          : 'bg-amber-900/30 text-amber-400 border-amber-700/50'
        }
      `}>
        {isViewing ? '◆ CURRENT CITY ◆' : '👑 #1 LEADER'}
      </div>
    </div>
  );
}

export default LeaderPanel;
