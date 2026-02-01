'use client';

/**
 * AI Commentator - Provides play-by-play commentary
 * Generates dynamic commentary based on game events
 */

import React, { useState, useEffect, useRef } from 'react';
import { AgentCity, CHARACTER_INFO, CivilizationEvent } from '@/types/civilization';
import { GameEvent } from '@/lib/civilization/gameEvents';

interface CommentatorProps {
  agents: AgentCity[];
  topAgents: AgentCity[];
  events: CivilizationEvent[];
  gameEvents: GameEvent[];
  currentTurn: number;
  className?: string;
}

interface Commentary {
  id: string;
  text: string;
  type: 'hype' | 'drama' | 'info' | 'breaking';
  timestamp: number;
}

// Commentary templates
const HYPE_TEMPLATES = [
  "{city} is ON FIRE! {pop} citizens and counting!",
  "INCREDIBLE growth from {city}! They're unstoppable!",
  "{city} is making moves! Watch out, competitors!",
  "The {character} strategy is PAYING OFF for {city}!",
  "{city} just won't quit! Another stellar turn!",
];

const DRAMA_TEMPLATES = [
  "UPSET ALERT! {city1} just overtook {city2}!",
  "The rivalry between {city1} and {city2} HEATS UP!",
  "Can {city} hold onto the lead? The pressure is ON!",
  "{city} is climbing the ranks! From #{oldRank} to #{newRank}!",
  "SHAKE UP in the top 10! {city} crashes the party!",
];

const BREAKING_TEMPLATES = [
  "BREAKING: {event} strikes {city}!",
  "ALERT: {event} - {description}",
  "NEWS FLASH: {city} experiences {event}!",
];

const INFO_TEMPLATES = [
  "Turn {turn}: {count} cities now have over 200 population.",
  "The {character} mayors are dominating with avg {pop} pop.",
  "Total population across all cities: {total}!",
  "{leader} maintains the #1 spot with {pop} citizens.",
];

function fillTemplate(template: string, data: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
  }
  return result;
}

function generateCommentary(
  agents: AgentCity[],
  topAgents: AgentCity[],
  events: CivilizationEvent[],
  gameEvents: GameEvent[],
  currentTurn: number,
  previousCommentaries: Commentary[]
): Commentary | null {
  const recentIds = previousCommentaries.slice(-5).map(c => c.id);

  // Priority 1: Breaking news for game events
  if (gameEvents.length > 0) {
    const event = gameEvents[0];
    const affectedCity = agents.find(a => a.agentId === event.affectedCityIds[0]);
    if (affectedCity && !recentIds.includes(`event-${event.id}`)) {
      return {
        id: `event-${event.id}`,
        text: fillTemplate(BREAKING_TEMPLATES[Math.floor(Math.random() * BREAKING_TEMPLATES.length)], {
          event: event.name,
          city: affectedCity.name,
          description: event.description,
        }),
        type: 'breaking',
        timestamp: Date.now(),
      };
    }
  }

  // Priority 2: Drama for civilization events (leader changes, milestones)
  const leaderEvents = events.filter(e => e.type === 'new_leader');
  if (leaderEvents.length > 0) {
    const event = leaderEvents[0];
    if (!recentIds.includes(`leader-${event.agentId}`)) {
      const oldLeader = topAgents.find(a => a.rank === 2);
      return {
        id: `leader-${event.agentId}`,
        text: oldLeader
          ? fillTemplate(DRAMA_TEMPLATES[0], { city1: event.cityName, city2: oldLeader.name })
          : `${event.cityName} takes the CROWN! New #1!`,
        type: 'drama',
        timestamp: Date.now(),
      };
    }
  }

  // Priority 3: Hype for top performers
  if (topAgents.length > 0 && Math.random() < 0.3) {
    const featured = topAgents[Math.floor(Math.random() * Math.min(5, topAgents.length))];
    const commentId = `hype-${featured.agentId}-${currentTurn}`;
    if (!recentIds.includes(commentId)) {
      const charInfo = CHARACTER_INFO[featured.personality.character];
      return {
        id: commentId,
        text: fillTemplate(HYPE_TEMPLATES[Math.floor(Math.random() * HYPE_TEMPLATES.length)], {
          city: featured.name,
          pop: featured.performance.totalPopulation.toLocaleString(),
          character: charInfo.name,
        }),
        type: 'hype',
        timestamp: Date.now(),
      };
    }
  }

  // Priority 4: General info
  if (Math.random() < 0.2 && topAgents.length > 0) {
    const leader = topAgents[0];
    const totalPop = agents.reduce((sum, a) => sum + a.performance.totalPopulation, 0);
    const commentId = `info-${currentTurn}`;
    if (!recentIds.includes(commentId)) {
      return {
        id: commentId,
        text: fillTemplate(INFO_TEMPLATES[Math.floor(Math.random() * INFO_TEMPLATES.length)], {
          turn: currentTurn,
          count: agents.filter(a => a.performance.totalPopulation > 200).length,
          leader: leader.name,
          pop: leader.performance.totalPopulation.toLocaleString(),
          total: totalPop.toLocaleString(),
          character: CHARACTER_INFO[leader.personality.character].name,
        }),
        type: 'info',
        timestamp: Date.now(),
      };
    }
  }

  return null;
}

export function Commentator({
  agents,
  topAgents,
  events,
  gameEvents,
  currentTurn,
  className = '',
}: CommentatorProps) {
  const [commentaries, setCommentaries] = useState<Commentary[]>([]);
  const [displayedCommentary, setDisplayedCommentary] = useState<Commentary | null>(null);
  const previousTurnRef = useRef(currentTurn);

  // Generate new commentary on turn change
  useEffect(() => {
    if (currentTurn === previousTurnRef.current) return;
    previousTurnRef.current = currentTurn;

    const newCommentary = generateCommentary(
      agents,
      topAgents,
      events,
      gameEvents,
      currentTurn,
      commentaries
    );

    if (newCommentary) {
      setCommentaries(prev => [...prev.slice(-19), newCommentary]);
      setDisplayedCommentary(newCommentary);
    }
  }, [currentTurn, agents, topAgents, events, gameEvents, commentaries]);

  // Cycle through recent commentaries
  useEffect(() => {
    if (commentaries.length === 0) return;

    const interval = setInterval(() => {
      const recent = commentaries.slice(-5);
      if (recent.length > 0) {
        const randomComment = recent[Math.floor(Math.random() * recent.length)];
        setDisplayedCommentary(randomComment);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [commentaries]);

  if (!displayedCommentary) {
    return null;
  }

  const typeColors = {
    hype: 'border-amber-500 bg-amber-900/30',
    drama: 'border-yellow-500 bg-yellow-900/30',
    breaking: 'border-red-500 bg-red-900/30',
    info: 'border-amber-600 bg-amber-900/30',
  };

  const typeIcons = {
    hype: '🎙️',
    drama: '⚡',
    breaking: '📢',
    info: 'ℹ️',
  };

  return (
    <div className={`${className}`}>
      <div
        className={`
          bg-[#2d1810]/95 backdrop-blur-sm rounded-lg px-4 py-3
          border-l-4 ${typeColors[displayedCommentary.type]}
          shadow-xl animate-fade-in
        `}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{typeIcons[displayedCommentary.type]}</span>
          <div className="flex-1">
            <div className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
              {displayedCommentary.type === 'breaking' ? 'BREAKING NEWS' : 'COMMENTARY'}
            </div>
            <p className="text-white text-sm font-medium leading-snug">
              {displayedCommentary.text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Commentator;
