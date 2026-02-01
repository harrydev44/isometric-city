'use client';

/**
 * Live Graph - Shows population trends over time
 * Displays sparklines for top cities
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface LiveGraphProps {
  agents: AgentCity[];
  topAgents: AgentCity[];
  currentTurn: number;
  className?: string;
}

interface HistoryPoint {
  turn: number;
  population: number;
}

interface CityHistory {
  agentId: number;
  name: string;
  character: string;
  history: HistoryPoint[];
}

// Colors for top 5 cities
const CITY_COLORS = ['#00CED1', '#f97316', '#22c55e', '#eab308', '#a855f7'];

export function LiveGraph({ agents, topAgents, currentTurn, className = '' }: LiveGraphProps) {
  const [cityHistories, setCityHistories] = useState<Map<number, CityHistory>>(new Map());
  const previousTurnRef = useRef(currentTurn);

  // Track history for top cities
  useEffect(() => {
    if (currentTurn === previousTurnRef.current && cityHistories.size > 0) return;
    previousTurnRef.current = currentTurn;

    setCityHistories(prev => {
      const newHistories = new Map(prev);

      // Track top 5 cities + any previously tracked cities still in top 10
      const citiesToTrack = topAgents.slice(0, 5);

      for (const agent of citiesToTrack) {
        const existing = newHistories.get(agent.agentId);
        const newPoint: HistoryPoint = {
          turn: currentTurn,
          population: agent.performance.totalPopulation,
        };

        if (existing) {
          // Add new point, keep last 20 turns
          newHistories.set(agent.agentId, {
            ...existing,
            name: agent.name,
            history: [...existing.history.slice(-19), newPoint],
          });
        } else {
          // Start tracking new city
          newHistories.set(agent.agentId, {
            agentId: agent.agentId,
            name: agent.name,
            character: agent.personality.character,
            history: [newPoint],
          });
        }
      }

      return newHistories;
    });
  }, [currentTurn, topAgents, cityHistories.size]);

  // Get top 5 histories sorted by current population
  const displayHistories = useMemo(() => {
    const top5Ids = topAgents.slice(0, 5).map(a => a.agentId);
    return top5Ids
      .map(id => cityHistories.get(id))
      .filter((h): h is CityHistory => h !== undefined && h.history.length >= 2);
  }, [cityHistories, topAgents]);

  // Calculate SVG path for a history
  const getSparklinePath = (history: HistoryPoint[], width: number, height: number): string => {
    if (history.length < 2) return '';

    const minPop = Math.min(...history.map(h => h.population));
    const maxPop = Math.max(...history.map(h => h.population));
    const range = maxPop - minPop || 1;

    const points = history.map((h, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((h.population - minPop) / range) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  if (displayHistories.length === 0) {
    return (
      <div className={`bg-[#0d1f35]/95 backdrop-blur-sm border-2 border-cyan-500/70 rounded-lg p-3 ${className}`}>
        <div className="text-cyan-400 text-xs font-bold mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
          POPULATION TRENDS
        </div>
        <div className="text-cyan-600 text-xs text-center py-4">
          Collecting data...
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#0d1f35]/95 backdrop-blur-sm border-2 border-cyan-500/70 rounded-lg p-3 ${className}`}>
      {/* Header */}
      <div className="text-cyan-400 text-xs font-bold mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
        POPULATION TRENDS
      </div>

      {/* Combined graph */}
      <div className="relative h-24 mb-3">
        <svg
          className="w-full h-full"
          viewBox="0 0 200 80"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          <line x1="0" y1="20" x2="200" y2="20" stroke="#0a1628" strokeWidth="1" />
          <line x1="0" y1="40" x2="200" y2="40" stroke="#0a1628" strokeWidth="1" />
          <line x1="0" y1="60" x2="200" y2="60" stroke="#0a1628" strokeWidth="1" />

          {/* Sparklines for each city */}
          {displayHistories.map((history, index) => (
            <path
              key={history.agentId}
              d={getSparklinePath(history.history, 200, 80)}
              fill="none"
              stroke={CITY_COLORS[index]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="space-y-1">
        {displayHistories.map((history, index) => {
          const latestPop = history.history[history.history.length - 1]?.population || 0;
          const prevPop = history.history[history.history.length - 2]?.population || latestPop;
          const change = latestPop - prevPop;
          const changePercent = prevPop > 0 ? ((change / prevPop) * 100).toFixed(1) : '0';

          return (
            <div key={history.agentId} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-1 rounded-full"
                style={{ backgroundColor: CITY_COLORS[index] }}
              />
              <span className="text-white/80 flex-1 truncate">{history.name}</span>
              <span className="text-cyan-400 font-medium tabular-nums">
                {latestPop.toLocaleString()}
              </span>
              <span className={`font-medium tabular-nums w-12 text-right ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {change >= 0 ? '+' : ''}{changePercent}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LiveGraph;
