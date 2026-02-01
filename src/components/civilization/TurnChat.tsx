'use client';

/**
 * Turn Chat - Scrollable panel showing recent city decisions
 * Displays turn-by-turn actions across all cities
 */

import React from 'react';
import { AgentCity, CHARACTER_INFO } from '@/types/civilization';

interface TurnChatProps {
  agents: AgentCity[];
  currentTurn: number;
  onCityClick?: (agentId: number) => void;
}

interface DecisionEntry {
  agentId: number;
  cityName: string;
  character: string;
  emoji: string;
  action: string;
  turn: number;
}

export function TurnChat({ agents, currentTurn, onCityClick }: TurnChatProps) {
  // Collect recent decisions from all agents
  const recentDecisions: DecisionEntry[] = agents
    .filter(agent => agent.lastDecision)
    .map(agent => ({
      agentId: agent.agentId,
      cityName: agent.name,
      character: agent.personality.character,
      emoji: CHARACTER_INFO[agent.personality.character].emoji,
      action: agent.lastDecision!.action,
      turn: currentTurn,
    }))
    .slice(0, 15);

  // Current city being highlighted (first in list with decision)
  const currentCity = agents.find(a => a.lastDecision);

  return (
    <div className="w-72 bg-[#2d1810]/95 border-2 border-amber-500/70 rounded-lg shadow-2xl backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="bg-amber-900/60 border-b border-amber-500/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-400 rounded-sm" />
          <span className="text-amber-300 font-bold text-sm tracking-wide">TURN CHAT</span>
        </div>
      </div>

      {/* Current city highlight */}
      {currentCity && (
        <div className="px-3 py-2 bg-[#1a0f0a] border-b border-amber-900/50">
          <div className="text-white font-bold text-sm">{currentCity.name}</div>
          <div className="text-amber-400 text-xs">
            {CHARACTER_INFO[currentCity.personality.character].name}
          </div>
        </div>
      )}

      {/* Scrollable decisions list */}
      <div className="max-h-64 overflow-y-auto">
        {recentDecisions.length === 0 ? (
          <div className="px-3 py-4 text-center text-amber-600 text-xs">
            Awaiting first decisions...
          </div>
        ) : (
          <div className="divide-y divide-amber-900/30">
            {recentDecisions.map((decision, index) => (
              <button
                key={`${decision.agentId}-${index}`}
                onClick={() => onCityClick?.(decision.agentId)}
                className="w-full px-3 py-2 text-left hover:bg-amber-900/20 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {/* Avatar */}
                  <span className="text-lg flex-shrink-0">{decision.emoji}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white/90 text-xs font-medium truncate">
                      "{decision.action}"
                    </div>
                    <div className="text-amber-500/70 text-[10px] mt-0.5">
                      {decision.cityName} • {CHARACTER_INFO[decision.character as keyof typeof CHARACTER_INFO].name}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-[#1a0f0a] border-t border-amber-900/50">
        <div className="text-amber-600 text-[10px] text-center">
          Turn {currentTurn} • {recentDecisions.length} recent actions
        </div>
      </div>
    </div>
  );
}

export default TurnChat;
