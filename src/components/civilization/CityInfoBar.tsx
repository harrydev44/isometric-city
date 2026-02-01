'use client';

/**
 * City Info Bar - Center bottom panel showing current city being viewed
 * Strategy game style with navigation - Medieval amber/gold theme
 */

import React from 'react';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface CityInfoBarProps {
  currentAgent: AgentCity | null;
  currentIndex: number;
  totalCities: number;
  onPrev: () => void;
  onNext: () => void;
}

export function CityInfoBar({
  currentAgent,
  currentIndex,
  totalCities,
  onPrev,
  onNext,
}: CityInfoBarProps) {
  if (!currentAgent) return null;

  const characterInfo = CHARACTER_INFO[currentAgent.personality.character];

  return (
    <div className="bg-[#2d1810]/95 backdrop-blur-sm border-2 border-amber-600/50 rounded-t-lg shadow-2xl">
      {/* Top row - City name and character */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-amber-900/50">
        <div className="flex items-center gap-3">
          {/* Navigation buttons */}
          <button
            onClick={onPrev}
            className="w-8 h-8 bg-[#1a0f0a] hover:bg-amber-900/50 border border-amber-600/50 rounded flex items-center justify-center text-amber-400 font-bold transition-colors"
          >
            ◀
          </button>

          {/* City info */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{characterInfo.emoji}</span>
            <div>
              <div className="text-white font-bold">{currentAgent.name}</div>
              <div className="text-amber-500 text-xs">
                {characterInfo.name} • Rank #{currentAgent.rank}
              </div>
            </div>
          </div>

          <button
            onClick={onNext}
            className="w-8 h-8 bg-[#1a0f0a] hover:bg-amber-900/50 border border-amber-600/50 rounded flex items-center justify-center text-amber-400 font-bold transition-colors"
          >
            ▶
          </button>
        </div>

        {/* City counter */}
        <div className="text-amber-600 text-sm">
          City <span className="text-white font-bold">{currentIndex + 1}</span> of {totalCities}
        </div>
      </div>

      {/* Bottom row - Stats */}
      <div className="flex items-center justify-center gap-6 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-700 text-xs">POP</span>
          <span className="text-amber-400 font-bold">{currentAgent.performance.totalPopulation.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-700 text-xs">$</span>
          <span className="text-amber-300 font-bold">{currentAgent.performance.totalMoney.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-700 text-xs">BLDG</span>
          <span className="text-amber-400 font-bold">{currentAgent.performance.buildingsPlaced}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-700 text-xs">PEAK</span>
          <span className="text-amber-300 font-bold">{currentAgent.performance.peakPopulation.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default CityInfoBar;
