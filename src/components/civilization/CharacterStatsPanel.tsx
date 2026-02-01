'use client';

/**
 * Character Stats Panel - Shows character type vs character type comparison
 * Medieval amber/gold theme with gradient progress bars
 */

import React from 'react';
import { CHARACTER_INFO } from '@/types/civilization';
import { CharacterStats } from '@/lib/turnManager';

interface CharacterStatsPanelProps {
  stats: CharacterStats[];
}

export function CharacterStatsPanel({ stats }: CharacterStatsPanelProps) {
  if (stats.length === 0) {
    return null;
  }

  const maxAvgPop = Math.max(...stats.map(s => s.avgPopulation));

  return (
    <div className="bg-[#2d1810]/95 backdrop-blur-sm border-2 border-amber-500/70 rounded-lg p-3 text-white shadow-2xl">
      <h3 className="text-sm font-bold mb-2 text-amber-400 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-sm" />
        Character Rankings
      </h3>

      <div className="space-y-2">
        {stats.map((stat, index) => {
          const info = CHARACTER_INFO[stat.character];
          const barWidth = maxAvgPop > 0 ? (stat.avgPopulation / maxAvgPop) * 100 : 0;

          return (
            <div key={stat.character} className="relative">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-amber-600 w-4">
                  {index + 1}
                </span>
                <span className="text-sm">{info.emoji}</span>
                <span className="text-xs text-white/80 flex-1">
                  {info.name}
                </span>
                <span className="text-xs font-medium text-amber-400">
                  {stat.avgPopulation.toLocaleString()}
                </span>
              </div>

              {/* Progress bar */}
              <div className="ml-6 h-1.5 bg-[#1a0f0a] border border-amber-900/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              <div className="ml-6 text-[10px] text-amber-700 mt-0.5">
                {stat.count} cities | ${stat.avgMoney.toLocaleString()} avg
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CharacterStatsPanel;
