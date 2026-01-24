export type GameType = 'iso-city' | 'iso-coaster';

export interface Game {
  id: GameType;
  name: string;
  url: string;
  icon: 'home' | 'ferrisWheel';
  color: string;
}

export interface Pane {
  id: string;
  gameType: GameType;
  url: string;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitNode {
  id: string;
  type: 'split';
  direction: SplitDirection;
  ratio: number; // 0-1, percentage for first child
  children: [PaneNode, PaneNode];
}

export interface LeafNode {
  id: string;
  type: 'leaf';
  pane: Pane;
}

export type PaneNode = SplitNode | LeafNode;

export interface AppState {
  layout: PaneNode;
  activePane: string | null;
}
