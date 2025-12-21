'use client';

import React from 'react';
import { PlayerId, PLAYER_COLORS, CompetitiveState, AIPlayer } from '@/types/competitive';

interface ScoreboardProps {
  competitiveState: CompetitiveState;
  playerScore: number;
  playerMoney: number;
}

export function Scoreboard({ competitiveState, playerScore, playerMoney }: ScoreboardProps) {
  if (!competitiveState.enabled) return null;
  
  // Build sorted list of all players
  const allPlayers = [
    {
      id: 'player' as PlayerId,
      name: 'You',
      score: playerScore,
      money: playerMoney,
      eliminated: false,
      color: PLAYER_COLORS.player,
    },
    ...competitiveState.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      money: p.money,
      eliminated: p.eliminated,
      color: PLAYER_COLORS[p.id],
    })),
  ].sort((a, b) => b.score - a.score);
  
  return (
    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm rounded-lg border border-white/20 p-3 min-w-[200px] z-50">
      <h3 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">
        Scoreboard
      </h3>
      <div className="space-y-1">
        {allPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`flex items-center justify-between px-2 py-1 rounded ${
              player.eliminated ? 'opacity-50' : ''
            } ${player.id === 'player' ? 'bg-blue-500/20' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/60">{index + 1}.</span>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player.color.primary }}
              />
              <span className={`text-sm ${player.id === 'player' ? 'text-white font-semibold' : 'text-white/80'}`}>
                {player.name}
              </span>
              {player.eliminated && (
                <span className="text-xs text-red-400">(eliminated)</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-yellow-400">
                ${Math.floor(player.money).toLocaleString()}
              </span>
              <span className="text-sm font-mono text-white font-bold">
                {Math.floor(player.score)}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Game Over indicator */}
      {competitiveState.gameOver && (
        <div className="mt-3 pt-2 border-t border-white/20">
          <div className="text-center">
            <span className={`text-lg font-bold ${
              competitiveState.winnerId === 'player' ? 'text-green-400' : 'text-red-400'
            }`}>
              {competitiveState.winnerId === 'player' ? 'VICTORY!' : 'DEFEAT'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
