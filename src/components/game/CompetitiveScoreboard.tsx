'use client';

import React, { useMemo } from 'react';
import { useGame } from '@/context/GameContext';
import { cn } from '@/lib/utils';

export function CompetitiveScoreboard() {
  const { state } = useGame();
  const comp = state.competitive;

  const rows = useMemo(() => {
    if (!comp) return [];
    const unitCounts = new Map<string, number>();
    for (const u of state.militaryUnits) {
      unitCounts.set(u.ownerId, (unitCounts.get(u.ownerId) ?? 0) + 1);
    }

    return comp.players
      .slice()
      .sort((a, b) => b.score - a.score)
      .map(p => ({
        ...p,
        units: unitCounts.get(p.id) ?? 0,
        isLocal: p.id === comp.localPlayerId,
      }));
  }, [comp, state.militaryUnits]);

  if (state.gameMode !== 'competitive' || !comp) return null;

  return (
    <div className="absolute top-3 left-3 z-50 pointer-events-none">
      <div className="pointer-events-none bg-black/35 backdrop-blur-sm border border-white/10 rounded-md shadow-lg min-w-[260px]">
        <div className="px-3 py-2 border-b border-white/10">
          <div className="text-[11px] tracking-widest font-semibold text-white/80 uppercase">
            Scoreboard
          </div>
        </div>
        <div className="px-2 py-2 flex flex-col gap-1">
          {rows.map(p => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded-sm',
                p.isLocal ? 'bg-white/10' : 'bg-transparent',
                p.eliminated ? 'opacity-50' : 'opacity-100',
              )}
            >
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/90 truncate">
                  {p.name}{p.eliminated ? ' (eliminated)' : ''}
                </div>
                <div className="text-[10px] text-white/60">
                  ${p.money.toLocaleString()} • {p.units} units • Age {p.age}
                </div>
              </div>
              <div className="text-xs tabular-nums text-white/90">
                {p.score.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        {comp.winnerId && (
          <div className="px-3 py-2 border-t border-white/10 text-xs text-white/90">
            Winner: {rows.find(r => r.id === comp.winnerId)?.name ?? 'Unknown'}
          </div>
        )}
      </div>
    </div>
  );
}

