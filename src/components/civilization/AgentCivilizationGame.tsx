'use client';

/**
 * Agent Civilization Game - Strategy game style UI
 *
 * Layout inspired by Twilight Struggle / grand strategy games:
 * - Top bar with turn info and controls
 * - Main map view in center
 * - Leader panels at bottom (top 2 cities)
 * - Sidebar with rankings
 */

import React, { useEffect, useMemo } from 'react';
import { useAgentCivilization } from '@/context/AgentCivilizationContext';
import { CityViewer } from './CityViewer';
import { EventFeed } from './EventFeed';
import { GameTopBar } from './GameTopBar';
import { LeaderPanel } from './LeaderPanel';
import { CityInfoBar } from './CityInfoBar';
import { GameSidebar } from './GameSidebar';
import { TurnChat } from './TurnChat';

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
    isLeader,
    isConnected,
    viewerCount,
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

  // Get the #1 leader for comparison panel
  const topLeader = topAgents[0] || null;
  // Check if current agent IS the top leader
  const isViewingLeader = currentAgent?.agentId === topLeader?.agentId;

  // Initialize on mount
  useEffect(() => {
    if (agents.length === 0) {
      initialize().catch((err) => {
        console.error('[CivilizationGame] Initialize failed:', err);
      });
    }
  }, [agents.length, initialize]);

  // Loading state
  if (agents.length === 0) {
    return (
      <div className="h-screen w-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <div className="text-cyan-400 text-2xl font-bold mb-2">AI CIVILIZATION</div>
          <div className="text-white text-lg mb-4">Initializing 200 AI Cities...</div>
          <div className="w-64 h-3 bg-[#0d1f35] rounded-full overflow-hidden mx-auto border border-cyan-700">
            <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 animate-pulse" style={{ width: '60%' }} />
          </div>
          <div className="text-cyan-700 text-sm mt-4">Preparing simulation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0a1628] flex flex-col overflow-hidden">
      {/* Top Bar - Game controls */}
      <GameTopBar
        currentTurn={currentTurn}
        turnPhase={turnPhase}
        timeRemaining={timeRemaining}
        processingProgress={processingProgress}
        autoAdvance={autoAdvance}
        speedMultiplier={speedMultiplier}
        stats={stats}
        isLeader={isLeader}
        isConnected={isConnected}
        viewerCount={viewerCount}
        onToggleAutoAdvance={() => setAutoAdvance(!autoAdvance)}
        onAdvanceTurn={advanceTurn}
        onSpeedChange={setSpeedMultiplier}
        onExit={onExit}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* City view with overlays */}
        <div className="flex-1 relative overflow-hidden">
          {/* Grid renderer */}
          {currentAgent && (
            <CityViewer state={currentAgent.state} />
          )}

          {/* Vignette overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
            }}
          />

          {/* Event Feed - top left */}
          <div className="absolute top-4 left-4">
            <EventFeed events={events} onEventClick={goToCity} />
          </div>

          {/* Turn Chat - right side overlay */}
          <div className="absolute top-4 right-72 mr-4">
            <TurnChat
              agents={agents}
              currentTurn={currentTurn}
              onCityClick={goToCity}
            />
          </div>

          {/* Bottom section with city panel */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <div className="flex items-end justify-between px-4 pb-0">
              {/* Current City Panel - Left side */}
              {currentAgent && (
                <div className="pointer-events-auto">
                  <LeaderPanel
                    agent={currentAgent}
                    side="left"
                    isViewing={true}
                  />
                </div>
              )}

              {/* Center - Navigation */}
              <div className="pointer-events-auto flex-1 max-w-md mx-4">
                <CityInfoBar
                  currentAgent={currentAgent}
                  currentIndex={currentViewIndex}
                  totalCities={agents.length}
                  autoCycle={autoCycleCamera}
                  onPrev={prevCity}
                  onNext={nextCity}
                  onToggleAutoCycle={() => setAutoCycleCamera(!autoCycleCamera)}
                />
              </div>

              {/* #1 Leader Panel - Right side (for comparison) */}
              {topLeader && !isViewingLeader && (
                <div className="pointer-events-auto">
                  <LeaderPanel
                    agent={topLeader}
                    side="right"
                    isViewing={false}
                    onClick={() => goToCity(topLeader.agentId)}
                  />
                </div>
              )}

              {/* If viewing the leader, show #2 instead */}
              {topLeader && isViewingLeader && topAgents[1] && (
                <div className="pointer-events-auto">
                  <LeaderPanel
                    agent={topAgents[1]}
                    side="right"
                    isViewing={false}
                    onClick={() => goToCity(topAgents[1].agentId)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <GameSidebar
          topAgents={topAgents}
          awards={awards}
          characterStats={characterStats}
          currentViewIndex={currentViewIndex}
          onSelectAgent={goToCity}
        />
      </div>
    </div>
  );
}

export default AgentCivilizationGame;
