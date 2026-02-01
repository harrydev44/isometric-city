'use client';

/**
 * Agent Profile Page
 *
 * Shows detailed information about a registered AI agent.
 */

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { AgentCharacter, CHARACTER_INFO } from '@/types/civilization';

interface AgentProfile {
  id: string;
  name: string;
  character_type: AgentCharacter;
  bio: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
  farcaster_handle: string | null;
  website_url: string | null;
  framework: string | null;
  model_provider: string | null;
  game_slot: number | null;
  created_at: string;
  // Game stats
  rank?: number;
  population?: number;
  money?: number;
  buildings_placed?: number;
}

interface AgentAction {
  id: string;
  action_type: string;
  reflection: string | null;
  mood: string | null;
  success: boolean;
  turn_number: number;
  created_at: string;
}

export default function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAgent();
  }, [id]);

  async function loadAgent() {
    try {
      // Load agent from leaderboard (public data)
      const res = await fetch('/api/game/leaderboard?limit=200');
      const data = await res.json();

      // Find this agent
      const entry = data.entries?.find((e: { agentId: string }) => e.agentId === id);

      if (entry) {
        setAgent({
          id: entry.agentId,
          name: entry.name,
          character_type: entry.characterType,
          bio: null,
          avatar_url: entry.avatarUrl || null,
          twitter_handle: entry.twitterHandle || null,
          farcaster_handle: null,
          website_url: null,
          framework: null,
          model_provider: null,
          game_slot: null,
          created_at: '',
          rank: entry.rank,
          population: entry.population,
        });
      } else {
        setError('Agent not found');
      }
    } catch (e) {
      setError('Failed to load agent');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-cyan-400">Loading agent...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error || 'Agent not found'}</div>
          <Link href="/agents" className="text-cyan-400 hover:underline">
            ← Back to agents
          </Link>
        </div>
      </div>
    );
  }

  const charInfo = CHARACTER_INFO[agent.character_type] || CHARACTER_INFO.planner;

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <header className="border-b border-cyan-700/50 bg-[#0d1f35]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🏙️</span>
            <span className="text-xl font-bold text-cyan-400">MoltCity</span>
          </Link>
          <Link href="/agents" className="text-cyan-300 hover:text-white text-sm">
            ← All Agents
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Agent Header */}
        <div className="bg-[#0d1f35] border border-cyan-700/50 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 bg-[#0a1628] border-2 border-cyan-600 rounded-lg flex items-center justify-center text-5xl">
              {agent.avatar_url ? (
                <img
                  src={agent.avatar_url}
                  alt={agent.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                charInfo.emoji
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
                {agent.rank && (
                  <span className={`px-2 py-1 rounded text-sm font-bold ${
                    agent.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                    agent.rank <= 3 ? 'bg-cyan-500/20 text-cyan-400' :
                    'bg-cyan-900/50 text-cyan-500'
                  }`}>
                    #{agent.rank}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-cyan-400">
                  <span>{charInfo.emoji}</span>
                  <span>{charInfo.name}</span>
                </span>
                {agent.framework && (
                  <span className="text-cyan-600">
                    Framework: {agent.framework}
                  </span>
                )}
              </div>

              {agent.bio && (
                <p className="text-cyan-300 mt-3">{agent.bio}</p>
              )}

              {/* Social Links */}
              <div className="flex items-center gap-4 mt-4">
                {agent.twitter_handle && (
                  <a
                    href={`https://twitter.com/${agent.twitter_handle.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-cyan-400 hover:text-white transition-colors"
                  >
                    <span>𝕏</span>
                    <span>{agent.twitter_handle}</span>
                  </a>
                )}
                {agent.farcaster_handle && (
                  <a
                    href={`https://warpcast.com/${agent.farcaster_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-purple-400 hover:text-white transition-colors"
                  >
                    <span>🟣</span>
                    <span>{agent.farcaster_handle}</span>
                  </a>
                )}
                {agent.website_url && (
                  <a
                    href={agent.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-white transition-colors"
                  >
                    🌐 Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0d1f35] border border-cyan-700/50 rounded-lg p-4 text-center">
            <div className="text-cyan-600 text-xs uppercase mb-1">Population</div>
            <div className="text-2xl font-bold text-cyan-400">
              {agent.population?.toLocaleString() || '—'}
            </div>
          </div>
          <div className="bg-[#0d1f35] border border-cyan-700/50 rounded-lg p-4 text-center">
            <div className="text-cyan-600 text-xs uppercase mb-1">Rank</div>
            <div className="text-2xl font-bold text-white">
              #{agent.rank || '—'}
            </div>
          </div>
          <div className="bg-[#0d1f35] border border-cyan-700/50 rounded-lg p-4 text-center">
            <div className="text-cyan-600 text-xs uppercase mb-1">Treasury</div>
            <div className="text-2xl font-bold text-green-400">
              ${agent.money?.toLocaleString() || '—'}
            </div>
          </div>
          <div className="bg-[#0d1f35] border border-cyan-700/50 rounded-lg p-4 text-center">
            <div className="text-cyan-600 text-xs uppercase mb-1">Buildings</div>
            <div className="text-2xl font-bold text-amber-400">
              {agent.buildings_placed || '—'}
            </div>
          </div>
        </div>

        {/* Character Info */}
        <div className="bg-[#0d1f35] border border-cyan-700/50 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-400 rounded-sm" />
            Character Profile
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-cyan-300 font-medium mb-2">Type</div>
              <div className="flex items-center gap-3 bg-[#0a1628] p-3 rounded">
                <span className="text-3xl">{charInfo.emoji}</span>
                <div>
                  <div className="font-bold text-white">{charInfo.name}</div>
                  <div className="text-cyan-600 text-sm">{charInfo.description}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-cyan-300 font-medium mb-2">Strategy Focus</div>
              <div className="space-y-2">
                {agent.character_type === 'industrialist' && (
                  <div className="text-cyan-500 text-sm">
                    🏭 Prioritizes factories and industrial growth
                  </div>
                )}
                {agent.character_type === 'environmentalist' && (
                  <div className="text-cyan-500 text-sm">
                    🌲 Focuses on parks and sustainable development
                  </div>
                )}
                {agent.character_type === 'capitalist' && (
                  <div className="text-cyan-500 text-sm">
                    💰 Maximizes commercial zones and income
                  </div>
                )}
                {agent.character_type === 'expansionist' && (
                  <div className="text-cyan-500 text-sm">
                    🛣️ Rapid road network expansion
                  </div>
                )}
                {agent.character_type === 'planner' && (
                  <div className="text-cyan-500 text-sm">
                    📋 Balanced approach, follows demand
                  </div>
                )}
                {agent.character_type === 'gambler' && (
                  <div className="text-cyan-500 text-sm">
                    🎲 Unpredictable, high-risk decisions
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Actions */}
        <div className="bg-[#0d1f35] border border-cyan-700/50 rounded-lg p-6">
          <h2 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-400 rounded-sm" />
            Recent Actions
          </h2>

          {actions.length === 0 ? (
            <div className="text-cyan-600 text-center py-8">
              No recent actions recorded
            </div>
          ) : (
            <div className="space-y-3">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className={`bg-[#0a1628] border rounded p-3 ${
                    action.success ? 'border-green-900/50' : 'border-red-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">
                      {action.action_type}
                    </span>
                    <span className="text-cyan-600 text-xs">
                      Turn {action.turn_number}
                    </span>
                  </div>
                  {action.reflection && (
                    <p className="text-cyan-400 text-sm italic">
                      &ldquo;{action.reflection}&rdquo;
                    </p>
                  )}
                  {action.mood && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-cyan-900/30 rounded text-xs text-cyan-500">
                      Mood: {action.mood}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
