'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { withPaneParam } from '@/lib/storageKeys';

type GameId = 'city' | 'coaster';

type GameDescriptor = {
  id: GameId;
  label: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
};

type PaneLeaf = {
  type: 'leaf';
  id: string;
  gameId: GameId;
};

type PaneSplit = {
  type: 'split';
  id: string;
  direction: 'vertical' | 'horizontal';
  children: [PaneNode, PaneNode];
};

type PaneNode = PaneLeaf | PaneSplit;

const GAMES: GameDescriptor[] = [
  { id: 'city', label: 'IsoCity', route: '/', icon: HouseIcon },
  { id: 'coaster', label: 'IsoCoaster', route: '/coaster', icon: RideIcon },
];

const gameById = new Map(GAMES.map((game) => [game.id, game]));

function createPaneId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pane-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSplitId(): string {
  return `split-${createPaneId()}`;
}

function splitPane(node: PaneNode, targetId: string, direction: PaneSplit['direction']): [PaneNode, string | null] {
  if (node.type === 'leaf') {
    if (node.id !== targetId) {
      return [node, null];
    }
    const newPaneId = createPaneId();
    const newLeaf: PaneLeaf = { type: 'leaf', id: newPaneId, gameId: node.gameId };
    return [
      {
        type: 'split',
        id: createSplitId(),
        direction,
        children: [node, newLeaf],
      },
      newPaneId,
    ];
  }

  const [left, newLeftId] = splitPane(node.children[0], targetId, direction);
  if (newLeftId) {
    return [{ ...node, children: [left, node.children[1]] }, newLeftId];
  }
  const [right, newRightId] = splitPane(node.children[1], targetId, direction);
  return [{ ...node, children: [node.children[0], right] }, newRightId];
}

function updatePaneGame(node: PaneNode, targetId: string, gameId: GameId): PaneNode {
  if (node.type === 'leaf') {
    return node.id === targetId ? { ...node, gameId } : node;
  }
  return {
    ...node,
    children: [
      updatePaneGame(node.children[0], targetId, gameId),
      updatePaneGame(node.children[1], targetId, gameId),
    ],
  };
}

function findPane(node: PaneNode, targetId: string): PaneLeaf | null {
  if (node.type === 'leaf') {
    return node.id === targetId ? node : null;
  }
  return findPane(node.children[0], targetId) ?? findPane(node.children[1], targetId);
}

function buildPaneSrc(gameId: GameId, paneId: string): string {
  const game = gameById.get(gameId);
  const route = game?.route ?? '/';
  return withPaneParam(route, paneId);
}

export default function DesktopWorkspace() {
  const [layout, setLayout] = useState<PaneNode>(() => ({
    type: 'leaf',
    id: createPaneId(),
    gameId: 'city',
  }));
  const [activePaneId, setActivePaneId] = useState<string | null>(() => {
    return layout.type === 'leaf' ? layout.id : null;
  });

  const activePane = useMemo(() => {
    if (!activePaneId) return null;
    return findPane(layout, activePaneId);
  }, [layout, activePaneId]);

  const handleSplit = useCallback(
    (paneId: string, direction: PaneSplit['direction']) => {
      setLayout((prev) => {
        const [nextLayout, newPaneId] = splitPane(prev, paneId, direction);
        if (newPaneId) {
          setActivePaneId(newPaneId);
        }
        return nextLayout;
      });
    },
    [],
  );

  const handleSelectGame = useCallback(
    (gameId: GameId) => {
      if (!activePaneId) return;
      setLayout((prev) => updatePaneGame(prev, activePaneId, gameId));
    },
    [activePaneId],
  );

  const renderNode = useCallback(
    (node: PaneNode): React.ReactNode => {
      if (node.type === 'leaf') {
        const game = gameById.get(node.gameId);
        const paneSrc = buildPaneSrc(node.gameId, node.id);
        const isActive = node.id === activePaneId;
        return (
          <section
            key={node.id}
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-white/10 bg-slate-950 ${
              isActive ? 'ring-2 ring-sky-400/40' : ''
            }`}
          >
            <header
              className="flex items-center justify-between gap-2 border-b border-white/10 bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-300"
              onClick={() => setActivePaneId(node.id)}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sky-400/80" />
                <span>{game?.label ?? 'Game'}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-200">
                <button
                  type="button"
                  className="rounded border border-white/10 bg-white/5 p-1 hover:bg-white/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSplit(node.id, 'vertical');
                  }}
                  title="Split vertical"
                >
                  <SplitVerticalIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded border border-white/10 bg-white/5 p-1 hover:bg-white/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSplit(node.id, 'horizontal');
                  }}
                  title="Split horizontal"
                >
                  <SplitHorizontalIcon className="h-4 w-4" />
                </button>
              </div>
            </header>
            <div className="flex-1 bg-black">
              <iframe
                key={`${node.id}-${node.gameId}`}
                title={`${game?.label ?? 'Game'} pane`}
                src={paneSrc}
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          </section>
        );
      }

      const directionClass = node.direction === 'vertical' ? 'flex-row' : 'flex-col';
      return (
        <div key={node.id} className={`flex min-h-0 min-w-0 flex-1 gap-2 ${directionClass}`}>
          {renderNode(node.children[0])}
          {renderNode(node.children[1])}
        </div>
      );
    },
    [activePaneId, handleSplit],
  );

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100">
      <aside className="flex w-16 flex-col items-center gap-3 border-r border-white/10 bg-slate-950 py-4">
        {GAMES.map((game) => {
          const Icon = game.icon;
          const isActive = activePane?.gameId === game.id;
          return (
            <button
              key={game.id}
              type="button"
              className={`flex h-11 w-11 items-center justify-center rounded-xl border text-slate-200 transition ${
                isActive
                  ? 'border-sky-400/70 bg-sky-400/10 text-sky-200'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
              onClick={() => handleSelectGame(game.id)}
              title={game.label}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </aside>
      <main className="flex min-h-0 flex-1 flex-col p-3">
        <div className="flex min-h-0 flex-1 flex-col gap-2">{renderNode(layout)}</div>
      </main>
    </div>
  );
}

function HouseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

function RideIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 18h5l3-7 3 7h7" />
      <path d="M9 11h6" />
      <circle cx="9" cy="18" r="1.3" />
      <circle cx="17" cy="18" r="1.3" />
    </svg>
  );
}

function SplitVerticalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="7.5" height="15" rx="1.5" />
      <rect x="13" y="4.5" width="7.5" height="15" rx="1.5" />
    </svg>
  );
}

function SplitHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4.5" y="3.5" width="15" height="7.5" rx="1.5" />
      <rect x="4.5" y="13" width="15" height="7.5" rx="1.5" />
    </svg>
  );
}
