'use client';

/**
 * Agent Civilization Game - Main component for AI Civilization Mode
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────┐
 * │ Agent Info (overlay)                                    │
 * ├─────────────────────────────────────────┬───────────────┤
 * │                                         │ Leaderboard   │
 * │     CanvasIsometricGridReadOnly         │               │
 * │     (shows current agent's city)        │               │
 * │                                         │               │
 * ├─────────────────────────────────────────┴───────────────┤
 * │ Turn Progress │ City Navigator │ Exit                    │
 * └─────────────────────────────────────────────────────────┘
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAgentCivilization } from '@/context/AgentCivilizationContext';
import { CityViewer } from './CityViewer';
import { AgentInfoPanel } from './AgentInfoPanel';
import { Leaderboard } from './Leaderboard';
import { TurnProgress } from './TurnProgress';
import { CityNavigator } from './CityNavigator';

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
    currentAgent,
    topAgents,
    stats,
    initialize,
    advanceTurn,
    setViewIndex,
    setAutoAdvance,
    setAutoCycleCamera,
    nextCity,
    prevCity,
  } = useAgentCivilization();

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
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* City view with overlays */}
        <div className="flex-1 relative">
          {/* Grid renderer - uses the real game renderer */}
          {currentAgent && (
            <CityViewer
              state={currentAgent.state}
              key={`city-${currentAgent.agentId}`}
            />
          )}

          {/* Agent info overlay */}
          {currentAgent && <AgentInfoPanel agent={currentAgent} />}

          {/* Global stats overlay */}
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
            <div className="text-xs text-white/50 mb-1">Global Stats</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-white/70">Total Pop:</span>
              <span className="font-medium">{stats.totalPopulation.toLocaleString()}</span>
              <span className="text-white/70">Average:</span>
              <span className="font-medium">{stats.averagePopulation.toLocaleString()}</span>
              <span className="text-white/70">Buildings:</span>
              <span className="font-medium">{stats.totalBuildingsPlaced.toLocaleString()}</span>
            </div>
          </div>

          {/* Exit button */}
          <button
            onClick={onExit}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white/80 hover:text-white hover:bg-black/80 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">Exit</span>
          </button>
        </div>

        {/* Leaderboard sidebar */}
        <div className="w-72 p-4 border-l border-white/10">
          <Leaderboard
            agents={topAgents}
            currentViewIndex={currentViewIndex}
            onSelectAgent={setViewIndex}
          />
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="h-16 border-t border-white/10 px-4 flex items-center justify-between gap-4">
        <TurnProgress
          currentTurn={currentTurn}
          turnPhase={turnPhase}
          timeRemaining={timeRemaining}
          processingProgress={processingProgress}
          autoAdvance={autoAdvance}
          onToggleAutoAdvance={() => setAutoAdvance(!autoAdvance)}
          onAdvanceTurn={advanceTurn}
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
