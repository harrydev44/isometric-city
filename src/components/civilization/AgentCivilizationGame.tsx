'use client';

/**
 * Agent Civilization Game - Main component for AI Civilization Mode
 *
 * Features:
 * - 200 AI agents managing cities
 * - Live event feed
 * - Character awards
 * - Character vs character stats
 * - Mini-map of all cities
 * - Speed control
 * - Animated leaderboard
 */

import React, { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAgentCivilization } from '@/context/AgentCivilizationContext';
import { CityViewer } from './CityViewer';
import { AgentInfoPanel } from './AgentInfoPanel';
import { Leaderboard } from './Leaderboard';
import { TurnProgress } from './TurnProgress';
import { CityNavigator } from './CityNavigator';
import { EventFeed } from './EventFeed';
import { CharacterAwards } from './CharacterAwards';
import { CharacterStatsPanel } from './CharacterStatsPanel';
import { MiniMap } from './MiniMap';

interface AgentCivilizationGameProps {
  onExit: () => void;
}

export function AgentCivilizationGame({ onExit }: AgentCivilizationGameProps) {
  const {
    agents,
    currentTurn,
    currentViewIndex,
    turnPhase,
    autoAdvance,
    autoCycleCamera,
    timeRemaining,
    processingProgress,
    speedMultiplier,
    events,
    awards,
    characterStats,
    currentAgent,
    topAgents,
    stats,
    initialize,
    advanceTurn,
    setViewIndex,
    setAutoAdvance,
    setAutoCycleCamera,
    setSpeedMultiplier,
    nextCity,
    prevCity,
    goToCity,
  } = useAgentCivilization();

  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showCharacterStats, setShowCharacterStats] = useState(true);

  // Initialize on mount
  useEffect(() => {
    if (agents.length === 0) {
      initialize();
    }
  }, [agents.length, initialize]);

  // Loading state
  if (agents.length === 0) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-2">Initializing 200 AI Cities...</div>
          <div className="text-white/50 text-sm">This may take a moment</div>
          <div className="mt-4 w-48 h-2 bg-white/10 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* City view with overlays */}
        <div className="flex-1 relative overflow-hidden">
          {/* Grid renderer - uses the real game renderer */}
          {currentAgent && (
            <CityViewer
              state={currentAgent.state}
            />
          )}

          {/* Vignette overlay for game aesthetic */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
            }}
          />

          {/* Agent info overlay - top left */}
          {currentAgent && <AgentInfoPanel agent={currentAgent} />}

          {/* Global stats overlay - top right (moved to avoid overlap with sidebar) */}
          <div className="absolute top-4 right-[340px] bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white text-sm border border-white/10">
            <div className="text-xs text-white/50 mb-1 uppercase tracking-wider">Global</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-white/60">Population:</span>
              <span className="font-bold text-cyan-400">{stats.totalPopulation.toLocaleString()}</span>
              <span className="text-white/60">Average:</span>
              <span className="font-medium">{stats.averagePopulation.toLocaleString()}</span>
              <span className="text-white/60">Buildings:</span>
              <span className="font-medium">{stats.totalBuildingsPlaced.toLocaleString()}</span>
            </div>
          </div>

          {/* Exit button - top center */}
          <button
            onClick={onExit}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-white/80 hover:text-white hover:bg-red-900/50 transition-colors flex items-center gap-2 border border-white/10"
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-medium">Exit Simulation</span>
          </button>

          {/* Event Feed - bottom left */}
          <EventFeed events={events} onEventClick={goToCity} />
        </div>

        {/* Right sidebar */}
        <div className="w-80 p-3 border-l border-white/10 flex flex-col gap-3 overflow-y-auto">
          {/* Leaderboard */}
          <Leaderboard
            agents={topAgents}
            currentViewIndex={currentViewIndex}
            onSelectAgent={setViewIndex}
          />

          {/* Character Awards */}
          <CharacterAwards awards={awards} onAwardClick={goToCity} />

          {/* Character Stats - collapsible */}
          <div>
            <button
              onClick={() => setShowCharacterStats(!showCharacterStats)}
              className="w-full flex items-center justify-between text-white/60 hover:text-white text-xs mb-1"
            >
              <span>Character Rankings</span>
              {showCharacterStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showCharacterStats && <CharacterStatsPanel stats={characterStats} />}
          </div>

          {/* Mini Map - collapsible */}
          <div>
            <button
              onClick={() => setShowMiniMap(!showMiniMap)}
              className="w-full flex items-center justify-between text-white/60 hover:text-white text-xs mb-1"
            >
              <span>All Cities Map</span>
              {showMiniMap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showMiniMap && (
              <MiniMap
                agents={agents}
                currentViewIndex={currentViewIndex}
                onCityClick={goToCity}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom control bar - game UI style */}
      <div className="h-20 bg-gradient-to-t from-black/90 to-black/60 backdrop-blur-sm border-t border-white/10 px-4 flex items-center gap-4">
        <TurnProgress
          currentTurn={currentTurn}
          turnPhase={turnPhase}
          timeRemaining={timeRemaining}
          processingProgress={processingProgress}
          autoAdvance={autoAdvance}
          speedMultiplier={speedMultiplier}
          onToggleAutoAdvance={() => setAutoAdvance(!autoAdvance)}
          onAdvanceTurn={advanceTurn}
          onSpeedChange={setSpeedMultiplier}
        />

        <CityNavigator
          currentIndex={currentViewIndex}
          totalCities={agents.length}
          autoCycle={autoCycleCamera}
          onPrev={prevCity}
          onNext={nextCity}
          onToggleAutoCycle={() => setAutoCycleCamera(!autoCycleCamera)}
        />
      </div>
    </div>
  );
}

export default AgentCivilizationGame;
