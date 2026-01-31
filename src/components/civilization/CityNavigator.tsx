'use client';

/**
 * City Navigator - Navigation controls for cycling through cities
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

interface CityNavigatorProps {
  currentIndex: number;
  totalCities: number;
  autoCycle: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoCycle: () => void;
}

export function CityNavigator({
  currentIndex,
  totalCities,
  autoCycle,
  onPrev,
  onNext,
  onToggleAutoCycle,
}: CityNavigatorProps) {
  return (
    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg p-2">
      <button
        onClick={onPrev}
        className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
        title="Previous city"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="text-sm text-white/80 min-w-[80px] text-center">
        <span className="font-medium">{currentIndex + 1}</span>
        <span className="text-white/50"> / {totalCities}</span>
      </div>

      <button
        onClick={onNext}
        className="p-2 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white"
        title="Next city"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div className="w-px h-6 bg-white/20 mx-1" />

      <button
        onClick={onToggleAutoCycle}
        className={`p-2 rounded transition-colors ${
          autoCycle
            ? 'bg-green-500/30 text-green-300 hover:bg-green-500/50'
            : 'hover:bg-white/10 text-white/60 hover:text-white'
        }`}
        title={autoCycle ? 'Stop auto-cycling' : 'Start auto-cycling'}
      >
        {autoCycle ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

export default CityNavigator;
