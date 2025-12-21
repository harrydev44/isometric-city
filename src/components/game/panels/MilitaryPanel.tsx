'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { MilitaryUnitType, MILITARY_UNIT_STATS, CompetitiveState, MilitaryUnit } from '@/types/competitive';

interface MilitaryPanelProps {
  competitiveState: CompetitiveState;
  money: number;
  onProduceUnit: (type: MilitaryUnitType) => void;
  onClose: () => void;
}

export function MilitaryPanel({ competitiveState, money, onProduceUnit, onClose }: MilitaryPanelProps) {
  // Count player's units
  const playerUnits = competitiveState.units.filter(
    u => u.ownerId === 'player' && u.state !== 'dead'
  );
  
  const unitCounts = {
    infantry: playerUnits.filter(u => u.type === 'infantry').length,
    tank: playerUnits.filter(u => u.type === 'tank').length,
    military_helicopter: playerUnits.filter(u => u.type === 'military_helicopter').length,
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-sidebar border border-sidebar-border rounded-lg shadow-2xl w-[400px] max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
          <h2 className="text-lg font-bold text-white">Military</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="h-7 w-7"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Unit Summary */}
          <div className="bg-black/20 rounded-lg p-3">
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Your Forces
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{unitCounts.infantry}</div>
                <div className="text-xs text-white/60">Infantry</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{unitCounts.tank}</div>
                <div className="text-xs text-white/60">Tanks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{unitCounts.military_helicopter}</div>
                <div className="text-xs text-white/60">Helicopters</div>
              </div>
            </div>
          </div>
          
          {/* Unit Production */}
          <div>
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Train Units (Requires Barracks)
            </h3>
            <div className="space-y-2">
              {(Object.entries(MILITARY_UNIT_STATS) as [MilitaryUnitType, typeof MILITARY_UNIT_STATS[MilitaryUnitType]][]).map(([type, stats]) => {
                const canAfford = money >= stats.cost;
                
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between p-3 bg-black/20 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <UnitIcon type={type as MilitaryUnitType} />
                        <span className="font-semibold text-white">{stats.name}</span>
                      </div>
                      <p className="text-xs text-white/60 mt-1">{stats.description}</p>
                      <div className="flex gap-3 mt-1 text-xs text-white/50">
                        <span>HP: {stats.health}</span>
                        <span>DMG: {stats.damage}</span>
                        <span>Speed: {stats.speed}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        size="sm"
                        onClick={() => onProduceUnit(type as MilitaryUnitType)}
                        disabled={!canAfford}
                        className="min-w-[80px]"
                      >
                        ${stats.cost}
                      </Button>
                      <span className="text-xs text-white/40">{stats.buildTime}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Instructions */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
              Commands
            </h3>
            <ul className="text-xs text-white/60 space-y-1">
              <li>• Click and drag to select units</li>
              <li>• Right-click on ground to move</li>
              <li>• Right-click on enemy building to attack</li>
              <li>• Units auto-attack nearby enemies</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnitIcon({ type }: { type: MilitaryUnitType }) {
  switch (type) {
    case 'infantry':
      return (
        <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="6" r="3" />
          <path d="M12 10c-3 0-5 2-5 5v5h10v-5c0-3-2-5-5-5z" />
        </svg>
      );
    case 'tank':
      return (
        <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="12" width="16" height="8" rx="2" />
          <rect x="6" y="8" width="6" height="4" rx="1" />
          <rect x="12" y="10" width="8" height="2" />
        </svg>
      );
    case 'military_helicopter':
      return (
        <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
          <ellipse cx="12" cy="14" rx="6" ry="3" />
          <rect x="2" y="11" width="20" height="2" />
          <rect x="4" y="12" width="3" height="1" />
        </svg>
      );
  }
}
