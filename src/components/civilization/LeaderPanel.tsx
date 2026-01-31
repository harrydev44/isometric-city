'use client';

/**
 * Leader Panel - Shows a city leader in strategy game style
 * Displays at bottom left/right like faction leaders
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
const CHARACTER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  industrialist: { bg: 'from-orange-900/80', border: 'border-orange-600', text: 'text-orange-400' },
  environmentalist: { bg: 'from-green-900/80', border: 'border-green-600', text: 'text-green-400' },
  capitalist: { bg: 'from-yellow-900/80', border: 'border-yellow-600', text: 'text-yellow-400' },
  expansionist: { bg: 'from-blue-900/80', border: 'border-blue-600', text: 'text-blue-400' },
  planner: { bg: 'from-purple-900/80', border: 'border-purple-600', text: 'text-purple-400' },
  gambler: { bg: 'from-red-900/80', border: 'border-red-600', text: 'text-red-400' },
};

export function LeaderPanel({ agent, side, isViewing = false, onClick }: LeaderPanelProps) {
  const { name, rank, performance, personality, lastDecision } = agent;
  const characterInfo = CHARACTER_INFO[personality.character];
  const colors = CHARACTER_COLORS[personality.character];

  const rankMedal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <div
      onClick={onClick}
      className={`
        w-72 bg-gradient-to-t ${colors.bg} to-slate-900/95
        border-2 ${colors.border} ${isViewing ? 'ring-2 ring-white/50' : ''}
        rounded-t-lg shadow-2xl cursor-pointer
        transition-all hover:scale-[1.02] hover:shadow-3xl
        ${side === 'left' ? 'rounded-tr-none' : 'rounded-tl-none'}
      `}
    >
      {/* Rank badge */}
      <div className={`
        absolute -top-3 ${side === 'left' ? 'left-3' : 'right-3'}
        bg-slate-800 border ${colors.border} rounded px-2 py-0.5
        text-xs font-bold ${colors.text}
      `}>
        #{rank} {rankMedal}
      </div>

      {/* Main content */}
      <div className="p-3 pt-4">
        {/* Character portrait area */}
        <div className="flex items-start gap-3">
          {/* Large emoji as "portrait" */}
          <div className={`
            w-16 h-16 bg-slate-800/80 border-2 ${colors.border}
            rounded flex items-center justify-center text-4xl
            shadow-inner
          `}>
            {characterInfo.emoji}
          </div>

          {/* Name and character type */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm truncate">{name}</h3>
            <div className={`text-xs ${colors.text} font-medium`}>
              {characterInfo.name}
            </div>
            <div className="text-slate-400 text-[10px] mt-1 truncate">
              "{characterInfo.description}"
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Population */}
          <div className="bg-slate-800/60 rounded px-2 py-1">
            <div className="text-slate-500 text-[10px] uppercase">Population</div>
            <div className="text-white font-bold text-lg">
              {performance.totalPopulation.toLocaleString()}
            </div>
          </div>

          {/* Treasury */}
          <div className="bg-slate-800/60 rounded px-2 py-1">
            <div className="text-slate-500 text-[10px] uppercase">Treasury</div>
            <div className="text-green-400 font-bold text-lg">
              ${(performance.totalMoney / 1000).toFixed(1)}k
            </div>
          </div>
        </div>

        {/* Global Influence style score */}
        <div className={`
          mt-2 bg-slate-800/80 border ${colors.border}
          rounded px-3 py-2 text-center
        `}>
          <div className="text-slate-400 text-[10px] uppercase tracking-wider">
            Total Score
          </div>
          <div className={`${colors.text} font-bold text-2xl`}>
            {(performance.totalPopulation + performance.buildingsPlaced * 10).toLocaleString()}
          </div>
        </div>

        {/* Last action */}
        {lastDecision && (
          <div className="mt-2 bg-slate-800/40 rounded px-2 py-1.5 border-l-2 border-slate-600">
            <div className="text-slate-500 text-[10px] uppercase">Last Action</div>
            <div className="text-slate-300 text-xs font-medium truncate">
              {lastDecision.action}
            </div>
          </div>
        )}
      </div>

      {/* Panel label */}
      <div className={`
        text-center py-1 text-xs font-medium border-t
        ${isViewing
          ? 'bg-cyan-900/50 text-cyan-300 border-cyan-700'
          : 'bg-amber-900/50 text-amber-300 border-amber-700'
        }
      `}>
        {isViewing ? '◆ CURRENT CITY ◆' : '👑 #1 LEADER'}
      </div>
    </div>
  );
}

export default LeaderPanel;
