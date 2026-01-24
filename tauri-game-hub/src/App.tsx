import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { SplitPane } from './components/SplitPane';
import type { PaneNode, GameType, SplitDirection } from './types';
import { 
  createLeafNode, 
  splitPane, 
  closePane, 
  updateRatio, 
  countPanes,
  findPaneById 
} from './utils';

const STORAGE_KEY = 'iso-game-hub-state';

interface SavedState {
  layout: PaneNode;
  activePane: string | null;
}

function loadState(): SavedState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return null;
}

function saveState(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

function App() {
  const [layout, setLayout] = useState<PaneNode>(() => {
    const saved = loadState();
    if (saved?.layout) {
      return saved.layout;
    }
    // Default to ISO City
    return createLeafNode('iso-city');
  });
  
  const [activePane, setActivePane] = useState<string | null>(() => {
    const saved = loadState();
    return saved?.activePane || null;
  });
  
  // Save state on changes
  useEffect(() => {
    saveState({ layout, activePane });
  }, [layout, activePane]);
  
  // Get the active game type from the active pane
  const getActiveGameType = useCallback((): GameType | null => {
    if (!activePane) return null;
    const pane = findPaneById(layout, activePane);
    return pane?.pane.gameType || null;
  }, [activePane, layout]);
  
  const handleSplit = useCallback((nodeId: string, direction: SplitDirection, gameType: GameType) => {
    setLayout((prev) => splitPane(prev, nodeId, direction, gameType));
  }, []);
  
  const handleClose = useCallback((nodeId: string) => {
    setLayout((prev) => {
      const newLayout = closePane(prev, nodeId);
      return newLayout || prev;
    });
  }, []);
  
  const handleUpdateRatio = useCallback((nodeId: string, ratio: number) => {
    setLayout((prev) => updateRatio(prev, nodeId, ratio));
  }, []);
  
  const handleFocus = useCallback((paneId: string) => {
    setActivePane(paneId);
  }, []);
  
  const handleSelectGame = useCallback(() => {
    // The sidebar highlight is determined by getActiveGameType()
    // The actual navigation happens through the pane itself
  }, []);
  
  const handleAddPane = useCallback((gameType: GameType) => {
    // Find the active pane or the first pane and split it
    if (layout.type === 'leaf') {
      // Split the only pane horizontally
      setLayout((prev) => splitPane(prev, prev.id, 'horizontal', gameType));
    } else {
      // Find a leaf to split
      const findFirstLeaf = (node: PaneNode): string | null => {
        if (node.type === 'leaf') return node.id;
        return findFirstLeaf(node.children[0]) || findFirstLeaf(node.children[1]);
      };
      const leafId = findFirstLeaf(layout);
      if (leafId) {
        setLayout((prev) => splitPane(prev, leafId, 'horizontal', gameType));
      }
    }
  }, [layout]);
  
  const paneCount = countPanes(layout);
  
  return (
    <div className="h-full w-full flex bg-pane-bg">
      {/* Sidebar */}
      <Sidebar
        activeGame={getActiveGameType()}
        onSelectGame={handleSelectGame}
        onAddPane={handleAddPane}
      />
      
      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <SplitPane
          node={layout}
          activePane={activePane}
          canClose={paneCount > 1}
          onSplit={handleSplit}
          onClose={handleClose}
          onUpdateRatio={handleUpdateRatio}
          onFocus={handleFocus}
        />
      </div>
    </div>
  );
}

export default App;
