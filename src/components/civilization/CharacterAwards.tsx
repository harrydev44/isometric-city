'use client';

/**
 * Character Awards - Shows category leaders
 * Grid layout with amber/gold headers
 */

import React from 'react';
import { CharacterAward } from '@/types/civilization';

interface CharacterAwardsProps {
  awards: CharacterAward[];
  onAwardClick?: (agentId: number) => void;
}

export function CharacterAwards({ awards, onAwardClick }: CharacterAwardsProps) {
  if (awards.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#2d1810]/95 backdrop-blur-sm border-2 border-amber-500/70 rounded-lg p-3 text-white shadow-2xl">
      <h3 className="text-sm font-bold mb-2 text-amber-400 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-sm" />
        Awards
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {awards.map((award) => (
          <button
            key={award.id}
            onClick={() => award.winnerId !== null && onAwardClick?.(award.winnerId)}
            className="bg-[#1a0f0a] border border-amber-900/50 p-2 rounded text-left
                       hover:bg-amber-900/30 hover:border-amber-600/50 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{award.emoji}</span>
              <span className="text-xs text-white/90 font-medium truncate">
                {award.name}
              </span>
            </div>
            <div className="text-[10px] text-amber-500/70 truncate">
              {award.winnerName} ({award.value.toLocaleString()})
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default CharacterAwards;
