'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCoaster } from '@/context/CoasterContext';
import CoasterCanvas from './CoasterCanvas';
import CoasterSidebar from './CoasterSidebar';
import CoasterMiniMap from './CoasterMiniMap';
import RidePanel from './panels/RidePanel';
import { T, Var, Num, Currency, useGT } from 'gt-next';

export default function CoasterGame() {
  const { state, setSpeed, newGame, setRidePrice, toggleRideStatus } = useCoaster();
  const gt = useGT();
  const [navigationTarget, setNavigationTarget] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<{ offset: { x: number; y: number }; zoom: number; canvasSize: { width: number; height: number } } | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);

  const selectedRide = useMemo(
    () => state.rides.find((ride) => ride.id === selectedRideId) ?? null,
    [selectedRideId, state.rides]
  );

  useEffect(() => {
    if (selectedRideId && !selectedRide) {
      setSelectedRideId(null);
    }
  }, [selectedRideId, selectedRide]);

  return (
    <div className="w-full h-full flex bg-background text-foreground">
      <CoasterSidebar />
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-slate-900/70">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold tracking-wide">{state.parkName}</div>
            <div className="text-xs text-muted-foreground">
              {gt('Year {year} · Day {day} · {time}', { year: state.year, day: state.day, time: `${state.hour.toString().padStart(2, '0')}:00` })}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <T><div>Guests: <Num>{state.stats.guestsInPark}</Num></div></T>
            <T><div>Rating: <Var>{state.stats.rating}</Var></div></T>
            <div className="font-medium"><Currency currency="USD">{state.finance.cash}</Currency></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={state.speed === 0 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(0)}>
              <T>Pause</T>
            </Button>
            <Button variant={state.speed === 1 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(1)}>
              <T>1x</T>
            </Button>
            <Button variant={state.speed === 2 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(2)}>
              <T>2x</T>
            </Button>
            <Button variant={state.speed === 3 ? 'default' : 'ghost'} size="sm" onClick={() => setSpeed(3)}>
              <T>3x</T>
            </Button>
            <Button variant="outline" size="sm" onClick={() => newGame()}>
              <T>New Park</T>
            </Button>
          </div>
        </div>
        <div className="flex-1 relative">
          <CoasterCanvas
            navigationTarget={navigationTarget}
            onNavigationComplete={() => setNavigationTarget(null)}
            onViewportChange={setViewport}
            onSelectRide={setSelectedRideId}
          />
          <CoasterMiniMap onNavigate={(x, y) => setNavigationTarget({ x, y })} viewport={viewport} />
          {selectedRide && (
            <RidePanel
              ride={selectedRide}
              onClose={() => setSelectedRideId(null)}
              onToggleStatus={() => toggleRideStatus(selectedRide.id)}
              onPriceChange={(price) => setRidePrice(selectedRide.id, price)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
