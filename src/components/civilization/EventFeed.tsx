'use client';

/**
 * Event Feed - Shows live events and milestones
 */

import React, { useEffect, useState } from 'react';
import { CivilizationEvent } from '@/types/civilization';

interface EventFeedProps {
  events: CivilizationEvent[];
  onEventClick?: (agentId: number) => void;
}

export function EventFeed({ events, onEventClick }: EventFeedProps) {
  const [visibleEvents, setVisibleEvents] = useState<CivilizationEvent[]>([]);

  // Animate new events in
  useEffect(() => {
    setVisibleEvents(events.slice(0, 8));
  }, [events]);

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-20 left-4 w-72 pointer-events-none">
      <div className="space-y-1">
        {visibleEvents.map((event, index) => (
          <div
            key={event.id}
            className={`
              bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2
              pointer-events-auto cursor-pointer
              transform transition-all duration-300 ease-out
              hover:bg-black/80 hover:scale-102
              animate-slide-in-left
            `}
            style={{
              animationDelay: `${index * 50}ms`,
              opacity: 1 - (index * 0.1),
            }}
            onClick={() => onEventClick?.(event.agentId)}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">{event.emoji}</span>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium leading-tight">
                  {event.message}
                </p>
                <p className="text-white/40 text-xs">
                  Turn {event.turn}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventFeed;
