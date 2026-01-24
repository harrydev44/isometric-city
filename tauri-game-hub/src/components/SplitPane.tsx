import { useState, useRef, useCallback, useEffect } from 'react';
import type { PaneNode, SplitDirection, GameType } from '../types';
import { GamePane } from './GamePane';

interface SplitPaneProps {
  node: PaneNode;
  activePane: string | null;
  canClose: boolean;
  onSplit: (nodeId: string, direction: SplitDirection, gameType: GameType) => void;
  onClose: (nodeId: string) => void;
  onUpdateRatio: (nodeId: string, ratio: number) => void;
  onFocus: (paneId: string) => void;
}

// Separate component for leaf nodes
function LeafPane({
  node,
  activePane,
  canClose,
  onSplit,
  onClose,
  onFocus,
}: SplitPaneProps & { node: Extract<PaneNode, { type: 'leaf' }> }) {
  return (
    <GamePane
      pane={node.pane}
      isActive={activePane === node.pane.id}
      canClose={canClose}
      onSplit={(direction) => onSplit(node.id, direction, node.pane.gameType)}
      onClose={() => onClose(node.id)}
      onFocus={() => onFocus(node.pane.id)}
    />
  );
}

// Separate component for split nodes
function SplitContainer({
  node,
  activePane,
  canClose,
  onSplit,
  onClose,
  onUpdateRatio,
  onFocus,
}: SplitPaneProps & { node: Extract<PaneNode, { type: 'split' }> }) {
  // Local ratio state for smooth dragging, initialized from prop
  const [localRatio, setLocalRatio] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  
  // Use local ratio during drag, otherwise use prop
  const ratio = localRatio !== null ? localRatio : node.ratio;
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setLocalRatio(node.ratio); // Start with current ratio
    document.body.style.cursor = node.direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [node.direction, node.ratio]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    let newRatio: number;
    
    if (node.direction === 'horizontal') {
      newRatio = (e.clientX - rect.left) / rect.width;
    } else {
      newRatio = (e.clientY - rect.top) / rect.height;
    }
    
    // Clamp ratio between 10% and 90%
    newRatio = Math.max(0.1, Math.min(0.9, newRatio));
    setLocalRatio(newRatio);
  }, [node.direction]);
  
  const handleMouseUp = useCallback(() => {
    if (isDragging.current && localRatio !== null) {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onUpdateRatio(node.id, localRatio);
      setLocalRatio(null); // Clear local state, go back to using prop
    }
  }, [node.id, localRatio, onUpdateRatio]);
  
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);
  
  const isHorizontal = node.direction === 'horizontal';
  
  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full ${isHorizontal ? 'flex-row' : 'flex-col'}`}
    >
      {/* First child */}
      <div
        style={{
          [isHorizontal ? 'width' : 'height']: `calc(${ratio * 100}% - 2px)`,
          [isHorizontal ? 'height' : 'width']: '100%',
        }}
        className="overflow-hidden"
      >
        <SplitPane
          node={node.children[0]}
          activePane={activePane}
          canClose={canClose}
          onSplit={onSplit}
          onClose={onClose}
          onUpdateRatio={onUpdateRatio}
          onFocus={onFocus}
        />
      </div>
      
      {/* Resize handle */}
      <div
        className={`
          resize-handle flex-shrink-0
          ${isHorizontal 
            ? 'w-1 cursor-col-resize hover:bg-indigo-500' 
            : 'h-1 cursor-row-resize hover:bg-indigo-500'
          }
          bg-pane-border transition-colors duration-150
        `}
        onMouseDown={handleMouseDown}
      />
      
      {/* Second child */}
      <div
        style={{
          [isHorizontal ? 'width' : 'height']: `calc(${(1 - ratio) * 100}% - 2px)`,
          [isHorizontal ? 'height' : 'width']: '100%',
        }}
        className="overflow-hidden"
      >
        <SplitPane
          node={node.children[1]}
          activePane={activePane}
          canClose={canClose}
          onSplit={onSplit}
          onClose={onClose}
          onUpdateRatio={onUpdateRatio}
          onFocus={onFocus}
        />
      </div>
    </div>
  );
}

export function SplitPane(props: SplitPaneProps) {
  if (props.node.type === 'leaf') {
    return <LeafPane {...props} node={props.node} />;
  }
  
  return <SplitContainer {...props} node={props.node} />;
}
