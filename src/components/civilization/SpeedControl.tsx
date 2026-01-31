'use client';

/**
 * Speed Control - Allows changing simulation speed
 */

import React from 'react';
import { CIVILIZATION_CONSTANTS } from '@/types/civilization';

const { SPEED_OPTIONS } = CIVILIZATION_CONSTANTS;

interface SpeedControlProps {
  currentSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export function SpeedControl({ currentSpeed, onSpeedChange }: SpeedControlProps) {
  return (
    <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1">
      {SPEED_OPTIONS.map((speed) => (
        <button
          key={speed}
          onClick={() => onSpeedChange(speed)}
          className={`
            px-2 py-1 rounded text-xs font-medium transition-colors
            ${currentSpeed === speed
              ? 'bg-blue-500 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/10'
            }
          `}
        >
          {speed}x
        </button>
      ))}
    </div>
  );
}

export default SpeedControl;
