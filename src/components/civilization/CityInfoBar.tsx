'use client';

/**
 * City Info Bar - Center bottom panel showing current city being viewed
 * Strategy game style with navigation
 */

import React from 'react';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface CityInfoBarProps {
  currentAgent: AgentCity | null;
  currentIndex: number;
  totalCities: number;
  autoCycle: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoCycle: () => void;
}

export function CityInfoBar({
  currentAgent,
  currentIndex,
  totalCities,
  autoCycle,
  onPrev,
  onNext,
  onToggleAutoCycle,
}: CityInfoBarProps) {
  if (!currentAgent) return null;

  const characterInfo = CHARACTER_INFO[currentAgent.personality.character];

  return (
    <div className="bg-gradient-to-t from-slate-900 to-slate-800/95 border-2 border-slate-600 rounded-t-lg shadow-2xl">
      {/* Top row - City name and character */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-3">
          {/* Navigation buttons */}
          <button
            onClick={onPrev}
            className="w-8 h-8 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded flex items-center justify-center text-white font-bold transition-colors"
          >
            ◀
          </button>

          {/* City info */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">{characterInfo.emoji}</span>
            <div>
              <div className="text-white font-bold">{currentAgent.name}</div>
              <div className="text-slate-400 text-xs">
                {characterInfo.name} • Rank #{currentAgent.rank}
              </div>
            </div>
          </div>

          <button
            onClick={onNext}
            className="w-8 h-8 bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded flex items-center justify-center text-white font-bold transition-colors"
          >
            ▶
          </button>
        </div>

        {/* City counter */}
        <div className="flex items-center gap-3">
          <div className="text-slate-400 text-sm">
            City <span className="text-white font-bold">{currentIndex + 1}</span> of {totalCities}
          </div>

          <button
            onClick={onToggleAutoCycle}
            className={`px-3 py-1 rounded text-xs font-bold transition-colors border ${
              autoCycle
                ? 'bg-cyan-700/50 border-cyan-500 text-cyan-300'
                : 'bg-slate-700/50 border-slate-500 text-slate-400'
            }`}
          >
            {autoCycle ? '⟳ AUTO-CYCLE' : '⟳ CYCLE OFF'}
          </button>
        </div>
      </div>

      {/* Bottom row - Stats */}
      <div className="flex items-center justify-center gap-6 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">POP</span>
          <span className="text-cyan-400 font-bold">{currentAgent.performance.totalPopulation.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">$</span>
          <span className="text-green-400 font-bold">{currentAgent.performance.totalMoney.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">BLDG</span>
          <span className="text-amber-400 font-bold">{currentAgent.performance.buildingsPlaced}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">PEAK</span>
          <span className="text-purple-400 font-bold">{currentAgent.performance.peakPopulation.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default CityInfoBar;
