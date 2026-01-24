import type { PaneNode, LeafNode, SplitNode, SplitDirection, Pane, GameType } from './types';
import { getGameUrl } from './games';

let paneIdCounter = 0;
let nodeIdCounter = 0;

export function generatePaneId(): string {
  return `pane-${++paneIdCounter}`;
}

export function generateNodeId(): string {
  return `node-${++nodeIdCounter}`;
}

export function createPane(gameType: GameType): Pane {
  return {
    id: generatePaneId(),
    gameType,
    url: getGameUrl(gameType),
  };
}

export function createLeafNode(gameType: GameType): LeafNode {
  return {
    id: generateNodeId(),
    type: 'leaf',
    pane: createPane(gameType),
  };
}

export function createSplitNode(
  direction: SplitDirection,
  first: PaneNode,
  second: PaneNode
): SplitNode {
  return {
    id: generateNodeId(),
    type: 'split',
    direction,
    ratio: 0.5,
    children: [first, second],
  };
}

export function findNodeById(root: PaneNode, id: string): PaneNode | null {
  if (root.id === id) return root;
  
  if (root.type === 'split') {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  
  return null;
}

export function findPaneById(root: PaneNode, paneId: string): LeafNode | null {
  if (root.type === 'leaf' && root.pane.id === paneId) {
    return root;
  }
  
  if (root.type === 'split') {
    for (const child of root.children) {
      const found = findPaneById(child, paneId);
      if (found) return found;
    }
  }
  
  return null;
}

export function findParent(root: PaneNode, nodeId: string): SplitNode | null {
  if (root.type === 'leaf') return null;
  
  for (const child of root.children) {
    if (child.id === nodeId) {
      return root as SplitNode;
    }
    const found = findParent(child, nodeId);
    if (found) return found;
  }
  
  return null;
}

export function splitPane(
  root: PaneNode,
  nodeId: string,
  direction: SplitDirection,
  gameType: GameType
): PaneNode {
  const splitNode = (node: PaneNode): PaneNode => {
    if (node.id === nodeId && node.type === 'leaf') {
      // Create a new pane with the same game type (goes to homepage)
      const newLeaf = createLeafNode(gameType);
      return createSplitNode(direction, node, newLeaf);
    }
    
    if (node.type === 'split') {
      return {
        ...node,
        children: [splitNode(node.children[0]), splitNode(node.children[1])] as [PaneNode, PaneNode],
      };
    }
    
    return node;
  };
  
  return splitNode(root);
}

export function closePane(root: PaneNode, nodeId: string): PaneNode | null {
  // If root is the node to close, return null (can't close last pane)
  if (root.id === nodeId) {
    return null;
  }
  
  const closeNode = (node: PaneNode): PaneNode | null => {
    if (node.type === 'leaf') {
      return node;
    }
    
    const [first, second] = node.children;
    
    if (first.id === nodeId) {
      return second;
    }
    if (second.id === nodeId) {
      return first;
    }
    
    const newFirst = closeNode(first);
    const newSecond = closeNode(second);
    
    if (newFirst === null) return newSecond;
    if (newSecond === null) return newFirst;
    
    if (newFirst !== first || newSecond !== second) {
      return {
        ...node,
        children: [newFirst, newSecond] as [PaneNode, PaneNode],
      };
    }
    
    return node;
  };
  
  return closeNode(root);
}

export function updateRatio(root: PaneNode, nodeId: string, ratio: number): PaneNode {
  const update = (node: PaneNode): PaneNode => {
    if (node.id === nodeId && node.type === 'split') {
      return { ...node, ratio: Math.max(0.1, Math.min(0.9, ratio)) };
    }
    
    if (node.type === 'split') {
      return {
        ...node,
        children: [update(node.children[0]), update(node.children[1])] as [PaneNode, PaneNode],
      };
    }
    
    return node;
  };
  
  return update(root);
}

export function countPanes(root: PaneNode): number {
  if (root.type === 'leaf') return 1;
  return countPanes(root.children[0]) + countPanes(root.children[1]);
}

export function getAllPanes(root: PaneNode): LeafNode[] {
  if (root.type === 'leaf') return [root];
  return [...getAllPanes(root.children[0]), ...getAllPanes(root.children[1])];
}
