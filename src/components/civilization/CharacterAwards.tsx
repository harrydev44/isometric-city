'use client';

/**
 * Character Awards - Shows category leaders
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
    <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
      <h3 className="text-sm font-bold mb-2 text-white/80 flex items-center gap-2">
        <span>🏆</span>
        Awards
      </h3>

      <div className="space-y-1.5">
        {awards.map((award) => (
          <button
            key={award.id}
            onClick={() => award.winnerId !== null && onAwardClick?.(award.winnerId)}
            className="w-full flex items-center gap-2 p-1.5 rounded text-left text-xs
                       hover:bg-white/10 transition-colors"
          >
            <span className="text-base">{award.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white/90 font-medium truncate">
                {award.name}
              </div>
              <div className="text-white/50 truncate">
                {award.winnerName} ({award.value.toLocaleString()})
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default CharacterAwards;
