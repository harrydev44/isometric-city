'use client';

/**
 * Game Events Display - Shows recent game events
 * Disasters, booms, crises, miracles
 */

import React from 'react';
import { GameEvent } from '@/lib/civilization/gameEvents';

interface GameEventsDisplayProps {
  events: GameEvent[];
  onEventClick?: (agentId: number) => void;
  className?: string;
}

const SEVERITY_COLORS = {
  minor: 'border-amber-400 bg-amber-900/20',
  moderate: 'border-amber-500 bg-amber-900/20',
  major: 'border-orange-500 bg-orange-900/20',
  catastrophic: 'border-red-500 bg-red-900/20',
};

const TYPE_ICONS = {
  disaster: '💥',
  boom: '📈',
  crisis: '⚠️',
  miracle: '✨',
  rivalry: '⚔️',
  alliance: '🤝',
};

export function GameEventsDisplay({ events, onEventClick, className = '' }: GameEventsDisplayProps) {
  if (events.length === 0) {
    return null;
  }

  // Show only last 3 events
  const recentEvents = events.slice(0, 3);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {recentEvents.map((event) => (
        <div
          key={event.id}
          onClick={() => event.affectedCityIds[0] !== undefined && onEventClick?.(event.affectedCityIds[0])}
          className={`
            bg-[#2d1810]/90 backdrop-blur-sm rounded px-3 py-2
            border-l-4 ${SEVERITY_COLORS[event.severity]}
            cursor-pointer hover:bg-amber-900/30 transition-colors
            animate-slide-in-right
          `}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg">{event.emoji || TYPE_ICONS[event.type]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-bold">{event.name}</div>
              <div className="text-amber-400/70 text-[10px] truncate">{event.description}</div>
            </div>
            <span className="text-amber-600 text-[9px]">T{event.turn}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default GameEventsDisplay;
