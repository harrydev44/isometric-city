'use client';

/**
 * Mini World Map - Shows all 200 cities as colored dots
 * Highlights current city and #1 leader
 */

import React, { useMemo } from 'react';
import { AgentCity, CHARACTER_INFO, AgentCharacter } from '@/types/civilization';

interface MiniWorldMapProps {
  agents: AgentCity[];
  currentViewIndex: number;
  topAgentId: number | null;
  onCityClick?: (agentId: number) => void;
  className?: string;
}

// Character type colors
const CHARACTER_COLORS: Record<AgentCharacter, string> = {
  industrialist: '#f97316',
  environmentalist: '#22c55e',
  capitalist: '#eab308',
  expansionist: '#3b82f6',
  planner: '#a855f7',
  gambler: '#ef4444',
};

// Generate deterministic positions for 200 cities
function generateCityPositions(count: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const cols = 20;
  const rows = 10;
  const cellWidth = 100 / cols;
  const cellHeight = 100 / rows;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Add some randomness within the cell (deterministic based on index)
    const seed = i * 37 + 17;
    const offsetX = ((seed * 1103515245 + 12345) % 100) / 200;
    const offsetY = ((seed * 1103515245 + 54321) % 100) / 200;

    positions.push({
      x: (col + 0.3 + offsetX) * cellWidth,
      y: (row + 0.3 + offsetY) * cellHeight,
    });
  }

  return positions;
}

export function MiniWorldMap({
  agents,
  currentViewIndex,
  topAgentId,
  onCityClick,
  className = '',
}: MiniWorldMapProps) {
  // Memoize city positions
  const cityPositions = useMemo(() => generateCityPositions(200), []);

  // Get current city's agent
  const currentAgent = agents[currentViewIndex];

  return (
    <div className={`bg-[#0d1f35]/95 backdrop-blur-sm border-2 border-cyan-500/70 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-cyan-900/60 border-b border-cyan-500/50 px-2 py-1.5 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
        <span className="text-cyan-300 font-bold text-[10px] tracking-wide">WORLD MAP</span>
        <span className="text-cyan-600 text-[10px] ml-auto">{agents.length} cities</span>
      </div>

      {/* Map */}
      <div className="relative w-full aspect-[2/1] bg-[#0a1628]">
        <svg
          className="w-full h-full"
          viewBox="0 0 100 50"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke="#0d1f35"
                strokeWidth="0.2"
              />
            </pattern>
          </defs>
          <rect width="100" height="50" fill="url(#grid)" />

          {/* City dots */}
          {agents.map((agent, index) => {
            const pos = cityPositions[index] || { x: 0, y: 0 };
            const isCurrentCity = agent.agentId === currentAgent?.agentId;
            const isTopCity = agent.agentId === topAgentId;
            const color = CHARACTER_COLORS[agent.personality.character];

            // Size based on population rank
            const sizeBase = isCurrentCity ? 2.5 : isTopCity ? 2 : agent.rank <= 10 ? 1.5 : 1;

            return (
              <g key={agent.id}>
                {/* Highlight ring for current/top city */}
                {(isCurrentCity || isTopCity) && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={sizeBase + 1.5}
                    fill="none"
                    stroke={isCurrentCity ? '#00CED1' : '#eab308'}
                    strokeWidth="0.5"
                    opacity="0.8"
                    className={isCurrentCity ? 'animate-pulse' : ''}
                  />
                )}

                {/* City dot */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={sizeBase}
                  fill={color}
                  opacity={agent.rank <= 20 ? 0.9 : 0.6}
                  className="cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => onCityClick?.(agent.agentId)}
                />
              </g>
            );
          })}
        </svg>

        {/* Current city label */}
        {currentAgent && (
          <div className="absolute bottom-1 left-1 bg-[#0a1628]/90 border border-cyan-700/50 rounded px-1.5 py-0.5">
            <div className="text-[9px] text-white font-medium flex items-center gap-1">
              <span>{CHARACTER_INFO[currentAgent.personality.character].emoji}</span>
              <span className="truncate max-w-[60px]">{currentAgent.name}</span>
              <span className="text-cyan-500">#{currentAgent.rank}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-2 py-1.5 border-t border-cyan-900/50 flex flex-wrap gap-x-2 gap-y-0.5">
        {Object.entries(CHARACTER_COLORS).map(([character, color]) => (
          <div key={character} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[8px] text-cyan-600 capitalize">{character.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MiniWorldMap;
