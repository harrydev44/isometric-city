'use client';

/**
 * MiniMap - Shows all 200 cities as colored dots
 * Colors based on character type, size based on population
 */

import React, { useMemo } from 'react';
import { AgentCity, CHARACTER_INFO, AgentCharacter } from '@/types/civilization';

interface MiniMapProps {
  agents: AgentCity[];
  currentViewIndex: number;
  onCityClick?: (agentId: number) => void;
}

const CHARACTER_COLORS: Record<AgentCharacter, string> = {
  industrialist: '#f97316', // orange
  environmentalist: '#22c55e', // green
  capitalist: '#eab308', // yellow
  expansionist: '#3b82f6', // blue
  planner: '#8b5cf6', // purple
  gambler: '#ef4444', // red
};

export function MiniMap({ agents, currentViewIndex, onCityClick }: MiniMapProps) {
  // Arrange agents in a grid (14x15 = 210 slots for 200 agents)
  const gridCols = 14;
  const gridRows = Math.ceil(agents.length / gridCols);

  const maxPopulation = useMemo(() => {
    return Math.max(...agents.map(a => a.performance.totalPopulation), 1);
  }, [agents]);

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
      <h3 className="text-sm font-bold mb-2 text-white/80">
        All 200 Cities
      </h3>

      {/* Grid of dots */}
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        }}
      >
        {agents.map((agent, index) => {
          const isSelected = agent.agentId === currentViewIndex;
          const color = CHARACTER_COLORS[agent.personality.character];
          const popRatio = agent.performance.totalPopulation / maxPopulation;
          const size = 4 + popRatio * 6; // 4-10px based on population

          return (
            <button
              key={agent.id}
              onClick={() => onCityClick?.(agent.agentId)}
              className={`
                relative rounded-full transition-all duration-200
                hover:scale-150 hover:z-10
                ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-black z-20' : ''}
              `}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: color,
                opacity: 0.6 + popRatio * 0.4,
              }}
              title={`${agent.name} (${CHARACTER_INFO[agent.personality.character].name}) - ${agent.performance.totalPopulation} pop`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-2 border-t border-white/10">
        <div className="flex flex-wrap gap-2 text-[10px]">
          {(Object.entries(CHARACTER_COLORS) as [AgentCharacter, string][]).map(([char, color]) => (
            <div key={char} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-white/60">{CHARACTER_INFO[char].emoji}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MiniMap;
