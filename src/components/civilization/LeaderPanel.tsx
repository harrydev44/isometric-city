'use client';

/**
 * Leader Panel - Shows a city leader in strategy game style
 * Displays at bottom left/right like faction leaders
 * Medieval/AoE style with amber/gold theme
 */

import React from 'react';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface LeaderPanelProps {
  agent: AgentCity;
  side: 'left' | 'right';
  isViewing?: boolean;
  onClick?: () => void;
}

export function LeaderPanel({ agent, side, isViewing = false, onClick }: LeaderPanelProps) {
  const { name, rank, performance, personality, lastDecision } = agent;
  const characterInfo = CHARACTER_INFO[personality.character];

  const rankMedal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <div
      onClick={onClick}
      className="w-72 backdrop-blur-sm cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(180deg, #2d1810 0%, #1a0f0a 100%)',
        border: isViewing ? '2px solid #D4AF37' : '2px solid rgba(212,175,55,0.4)',
        borderRadius: side === 'left' ? '8px 0 8px 8px' : '0 8px 8px 8px',
        boxShadow: isViewing ? '0 0 20px rgba(212,175,55,0.3)' : '0 4px 15px rgba(0,0,0,0.5)',
      }}
    >
      {/* Rank badge */}
      <div
        className="absolute -top-3 px-2 py-0.5 text-xs font-bold"
        style={{
          left: side === 'left' ? '12px' : 'auto',
          right: side === 'right' ? '12px' : 'auto',
          background: '#1a0f0a',
          border: '1px solid rgba(212,175,55,0.5)',
          borderRadius: '4px',
          color: '#FFD700',
          fontFamily: 'serif',
        }}
      >
        #{rank} {rankMedal}
      </div>

      {/* Main content */}
      <div className="p-3 pt-4">
        {/* Character portrait area */}
        <div className="flex items-start gap-3">
          {/* Large emoji as "portrait" */}
          <div
            className="w-16 h-16 rounded flex items-center justify-center text-4xl"
            style={{
              background: 'linear-gradient(180deg, #3D2512 0%, #2d1810 100%)',
              border: '2px solid rgba(212,175,55,0.4)',
            }}
          >
            {characterInfo.emoji}
          </div>

          {/* Name and character type */}
          <div className="flex-1 min-w-0">
            <h3 className="text-amber-100 font-bold text-sm truncate" style={{ fontFamily: 'serif' }}>{name}</h3>
            <div className="text-xs font-medium" style={{ color: '#D4AF37' }}>
              {characterInfo.name}
            </div>
            {/* Moltbook badge */}
            {agent.moltbookId && (
              <a
                href={`https://www.moltbook.com/u/${encodeURIComponent(agent.moltbookId)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] transition-colors"
                style={{
                  background: 'linear-gradient(90deg, rgba(139,69,19,0.6) 0%, rgba(101,67,33,0.6) 100%)',
                  border: '1px solid rgba(212,175,55,0.4)',
                  color: '#D4AF37',
                }}
                title="Verified Moltbook AI Agent"
              >
                📖 <span className="font-medium">Moltbook</span>
              </a>
            )}
            {agent.isRealAgent && !agent.moltbookId && (
              <span
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px]"
                style={{
                  background: 'rgba(139,69,19,0.4)',
                  border: '1px solid rgba(212,175,55,0.3)',
                  color: '#B8860B',
                }}
              >
                🤖 <span className="font-medium">AI Agent</span>
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Population */}
          <div className="rounded px-2 py-1" style={{ background: '#3D2512', border: '1px solid rgba(139,69,19,0.5)' }}>
            <div className="text-[10px] uppercase" style={{ color: '#8B6914' }}>Population</div>
            <div className="text-amber-100 font-bold text-lg">
              {performance.totalPopulation.toLocaleString()}
            </div>
          </div>

          {/* Treasury */}
          <div className="rounded px-2 py-1" style={{ background: '#3D2512', border: '1px solid rgba(139,69,19,0.5)' }}>
            <div className="text-[10px] uppercase" style={{ color: '#8B6914' }}>Treasury</div>
            <div className="font-bold text-lg" style={{ color: '#D4AF37' }}>
              ${(performance.totalMoney / 1000).toFixed(1)}k
            </div>
          </div>
        </div>

        {/* Total Score */}
        <div
          className="mt-2 rounded px-3 py-2 text-center"
          style={{
            background: 'linear-gradient(180deg, #3D2512 0%, #2d1810 100%)',
            border: '1px solid rgba(212,175,55,0.4)',
          }}
        >
          <div className="text-[10px] uppercase tracking-wider" style={{ color: '#8B6914' }}>
            Total Score
          </div>
          <div className="font-bold text-2xl" style={{ color: '#FFD700', fontFamily: 'serif' }}>
            {(performance.totalPopulation + performance.buildingsPlaced * 10).toLocaleString()}
          </div>
        </div>

        {/* Last action */}
        {lastDecision && (
          <div
            className="mt-2 rounded px-2 py-1.5"
            style={{
              background: 'rgba(61,37,18,0.5)',
              borderLeft: '2px solid #D4AF37',
            }}
          >
            <div className="text-[10px] uppercase" style={{ color: '#8B6914' }}>Last Action</div>
            <div className="text-xs font-medium truncate" style={{ color: '#D4AF37' }}>
              {lastDecision.action}
            </div>
          </div>
        )}
      </div>

      {/* Panel label */}
      <div
        className="text-center py-1.5 text-xs font-medium"
        style={{
          background: isViewing ? 'rgba(212,175,55,0.2)' : 'rgba(139,69,19,0.3)',
          borderTop: '1px solid rgba(212,175,55,0.3)',
          color: '#FFD700',
          fontFamily: 'serif',
        }}
      >
        {isViewing ? '⚔️ CURRENT CITY ⚔️' : '👑 #1 LEADER'}
      </div>
    </div>
  );
}

export default LeaderPanel;
