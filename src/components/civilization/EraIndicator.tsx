'use client';

/**
 * Era Indicator - Shows current era and progress to next
 * Eras: Ancient → Medieval → Industrial → Modern → Future
 */

import React from 'react';
import { getCurrentEra, getEraProgress, ERAS, Era } from '@/lib/civilization/gameEvents';

interface EraIndicatorProps {
  currentTurn: number;
  className?: string;
}

export function EraIndicator({ currentTurn, className = '' }: EraIndicatorProps) {
  const { current, next, progress } = getEraProgress(currentTurn);
  const currentEra = ERAS[current];
  const nextEra = next ? ERAS[next] : null;

  return (
    <div className={`bg-[#2d1810]/95 backdrop-blur-sm border-2 border-amber-500/70 rounded-lg px-3 py-2 ${className}`}>
      {/* Current Era */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{currentEra.emoji}</span>
        <div className="flex-1">
          <div className="text-white font-bold text-sm">{currentEra.name}</div>
          <div className="text-amber-600 text-[10px]">{currentEra.description}</div>
        </div>
      </div>

      {/* Progress to next era */}
      {nextEra && (
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-amber-500">Next: {nextEra.name}</span>
            <span className="text-amber-400">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-[#1a0f0a] rounded-full overflow-hidden border border-amber-900/30">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[9px] text-amber-700 mt-1 text-center">
            Turn {currentTurn} / {nextEra.turnThreshold}
          </div>
        </div>
      )}

      {/* At max era */}
      {!nextEra && (
        <div className="text-center">
          <div className="text-amber-400 text-[10px] font-bold">MAX ERA REACHED</div>
          <div className="text-amber-600 text-[9px]">The pinnacle of civilization!</div>
        </div>
      )}
    </div>
  );
}

export default EraIndicator;
