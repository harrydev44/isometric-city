'use client';

/**
 * Event Feed - Shows live events and milestones
 * Compact design showing only the most important recent events
 */

import React, { useEffect, useState } from 'react';
import { CivilizationEvent } from '@/types/civilization';

interface EventFeedProps {
  events: CivilizationEvent[];
  onEventClick?: (agentId: number) => void;
}

export function EventFeed({ events, onEventClick }: EventFeedProps) {
  const [visibleEvents, setVisibleEvents] = useState<CivilizationEvent[]>([]);

  // Show only 4 most recent events, and only important ones
  useEffect(() => {
    // Filter to only show new_leader and population milestones (skip rank jumps which are noisy)
    const importantEvents = events.filter(e =>
      e.type === 'new_leader' || e.type === 'population_milestone'
    );
    setVisibleEvents(importantEvents.slice(0, 4));
  }, [events]);

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <div className="w-64 pointer-events-none">
      <div className="space-y-1.5">
        {visibleEvents.map((event, index) => (
          <div
            key={event.id}
            className={`
              bg-black/80 backdrop-blur-sm rounded px-3 py-2
              pointer-events-auto cursor-pointer
              transform transition-all duration-300 ease-out
              hover:bg-black/90 hover:translate-x-1
              animate-slide-in-left
              border-l-2
              ${event.type === 'new_leader' ? 'border-yellow-500' : 'border-blue-500'}
            `}
            style={{
              animationDelay: `${index * 50}ms`,
              opacity: 1 - (index * 0.15),
            }}
            onClick={() => onEventClick?.(event.agentId)}
          >
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0">{event.emoji}</span>
              <p className="text-white text-xs font-medium leading-tight truncate">
                {event.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventFeed;
