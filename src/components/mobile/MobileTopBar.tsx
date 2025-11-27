'use client';

import React, { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  PlayIcon,
  PauseIcon,
  FastForwardIcon,
  PopulationIcon,
  MoneyIcon,
  HappyIcon,
  HealthIcon,
  EducationIcon,
  SafetyIcon,
  EnvironmentIcon,
} from '@/components/ui/Icons';

// Sun/Moon icon for time of day
function TimeOfDayIcon({ hour }: { hour: number }) {
  const isNight = hour < 6 || hour >= 20;
  const isDawn = hour >= 6 && hour < 8;
  const isDusk = hour >= 18 && hour < 20;

  if (isNight) {
    return (
      <svg className="w-3 h-3 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    );
  } else if (isDawn || isDusk) {
    return (
      <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
      </svg>
    );
  } else {
    return (
      <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0z" />
      </svg>
    );
  }
}

function DemandBar({ label, demand, color }: { label: string; demand: number; color: string }) {
  const percentage = Math.min(100, Math.abs(demand));
  const isPositive = demand >= 0;

  return (
    <div className="flex items-center gap-1">
      <span className={`text-[9px] font-bold ${color} w-2`}>{label}</span>
      <div className="w-8 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? color.replace('text-', 'bg-') : 'bg-red-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function MobileTopBar() {
  const { state, setSpeed, setTaxRate, isSaving } = useGame();
  const { stats, year, month, hour, speed, taxRate, cityName } = state;
  const [showDetails, setShowDetails] = useState(false);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <>
      {/* Main Top Bar */}
      <Card className="fixed top-0 left-0 right-0 z-40 rounded-none border-x-0 border-t-0 bg-card/95 backdrop-blur-sm safe-area-top">
        <div className="flex items-center justify-between px-3 py-2">
          {/* Left: City name and date */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="flex flex-col items-start min-w-0 active:opacity-70"
              onClick={() => setShowDetails(!showDetails)}
            >
              <div className="flex items-center gap-1">
                <span className="text-foreground font-semibold text-xs truncate max-w-[80px]">
                  {cityName}
                </span>
                {isSaving && (
                  <span className="text-[8px] text-muted-foreground animate-pulse">•</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-mono">
                <span>{monthNames[month - 1]} {year}</span>
                <TimeOfDayIcon hour={hour} />
              </div>
            </button>
          </div>

          {/* Center: Speed controls */}
          <div className="flex items-center gap-0.5 bg-secondary rounded-md p-0.5">
            {[0, 1, 2, 3].map((s) => (
              <Button
                key={s}
                onClick={() => setSpeed(s as 0 | 1 | 2 | 3)}
                variant={speed === s ? 'default' : 'ghost'}
                size="icon"
                className="h-7 w-7"
              >
                {s === 0 ? (
                  <PauseIcon size={12} />
                ) : s === 1 ? (
                  <PlayIcon size={12} />
                ) : s === 2 ? (
                  <FastForwardIcon size={12} />
                ) : (
                  <div className="flex items-center -space-x-1">
                    <PlayIcon size={8} />
                    <PlayIcon size={8} />
                  </div>
                )}
              </Button>
            ))}
          </div>

          {/* Right: Key stats */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-muted-foreground">Pop</span>
              <span className="text-xs font-mono font-semibold text-foreground">
                {stats.population >= 1000 ? `${(stats.population / 1000).toFixed(1)}k` : stats.population}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] text-muted-foreground">Funds</span>
              <span className={`text-xs font-mono font-semibold ${stats.money < 0 ? 'text-red-500' : stats.money < 1000 ? 'text-amber-500' : 'text-green-500'}`}>
                ${stats.money >= 1000000 ? `${(stats.money / 1000000).toFixed(1)}M` : stats.money >= 1000 ? `${(stats.money / 1000).toFixed(0)}k` : stats.money}
              </span>
            </div>
          </div>
        </div>

        {/* Demand indicators row */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-border/50 bg-secondary/30">
          <div className="flex items-center gap-3">
            <DemandBar label="R" demand={stats.demand.residential} color="text-green-500" />
            <DemandBar label="C" demand={stats.demand.commercial} color="text-blue-500" />
            <DemandBar label="I" demand={stats.demand.industrial} color="text-amber-500" />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Tax</span>
            <span className="text-[10px] font-mono text-foreground">{taxRate}%</span>
          </div>

          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-mono ${stats.income - stats.expenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.income - stats.expenses >= 0 ? '+' : ''}${(stats.income - stats.expenses).toLocaleString()}/mo
            </span>
          </div>
        </div>
      </Card>

      {/* Expanded Details Panel */}
      {showDetails && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm pt-[72px]"
          onClick={() => setShowDetails(false)}
        >
          <Card
            className="mx-2 mt-2 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Stats grid */}
            <div className="p-4 grid grid-cols-5 gap-3">
              <StatItem
                icon={<HappyIcon size={16} />}
                label="Happiness"
                value={stats.happiness}
                color={stats.happiness >= 70 ? 'text-green-500' : stats.happiness >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<HealthIcon size={16} />}
                label="Health"
                value={stats.health}
                color={stats.health >= 70 ? 'text-green-500' : stats.health >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<EducationIcon size={16} />}
                label="Education"
                value={stats.education}
                color={stats.education >= 70 ? 'text-green-500' : stats.education >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<SafetyIcon size={16} />}
                label="Safety"
                value={stats.safety}
                color={stats.safety >= 70 ? 'text-green-500' : stats.safety >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
              <StatItem
                icon={<EnvironmentIcon size={16} />}
                label="Environ"
                value={stats.environment}
                color={stats.environment >= 70 ? 'text-green-500' : stats.environment >= 40 ? 'text-amber-500' : 'text-red-500'}
              />
            </div>

            <Separator />

            {/* Detailed finances */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Population</span>
                <span className="text-sm font-mono text-foreground">{stats.population.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Jobs</span>
                <span className="text-sm font-mono text-foreground">{stats.jobs.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monthly Income</span>
                <span className="text-sm font-mono text-green-400">${stats.income.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Monthly Expenses</span>
                <span className="text-sm font-mono text-red-400">${stats.expenses.toLocaleString()}</span>
              </div>
            </div>

            <Separator />

            {/* Tax slider */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Tax Rate</span>
                <span className="text-sm font-mono text-foreground">{taxRate}%</span>
              </div>
              <Slider
                value={[taxRate]}
                onValueChange={(value) => setTaxRate(value[0])}
                min={0}
                max={20}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>20%</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{Math.round(value)}%</span>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

export default MobileTopBar;
