import { useState, useRef, useCallback } from 'react';
import { 
  SplitSquareHorizontal, 
  SplitSquareVertical, 
  X, 
  RefreshCw, 
  Home,
  ExternalLink,
  Maximize2,
  Minimize2
} from 'lucide-react';
import type { Pane, SplitDirection } from '../types';
import { getGame } from '../games';

interface GamePaneProps {
  pane: Pane;
  isActive: boolean;
  canClose: boolean;
  onSplit: (direction: SplitDirection) => void;
  onClose: () => void;
  onFocus: () => void;
}

export function GamePane({ 
  pane, 
  isActive, 
  canClose, 
  onSplit, 
  onClose, 
  onFocus 
}: GamePaneProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const game = getGame(pane.gameType);
  
  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = pane.url;
    }
  }, [pane.url]);
  
  const handleGoHome = useCallback(() => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = game.url;
    }
  }, [game.url]);
  
  const handleOpenExternal = useCallback(() => {
    window.open(pane.url, '_blank');
  }, [pane.url]);
  
  return (
    <div 
      className={`
        relative flex flex-col h-full w-full overflow-hidden
        ${isMaximized ? 'absolute inset-0 z-50' : ''}
      `}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onClick={onFocus}
    >
      {/* Toolbar - appears on hover */}
      <div 
        className={`
          absolute top-0 left-0 right-0 z-10
          flex items-center justify-between
          px-2 py-1
          bg-gradient-to-b from-black/70 to-transparent
          transition-opacity duration-200
          ${isHovering || isActive ? 'opacity-100' : 'opacity-0'}
        `}
      >
        {/* Left side - Game info */}
        <div className="flex items-center gap-2">
          <span 
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ 
              backgroundColor: `${game.color}20`,
              color: game.color 
            }}
          >
            {game.name}
          </span>
        </div>
        
        {/* Right side - Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleGoHome}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Go to homepage"
          >
            <Home size={14} className="text-white/80" />
          </button>
          
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className="text-white/80" />
          </button>
          
          <button
            onClick={handleOpenExternal}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Open in browser"
          >
            <ExternalLink size={14} className="text-white/80" />
          </button>
          
          <div className="w-px h-4 bg-white/20 mx-1" />
          
          <button
            onClick={() => onSplit('horizontal')}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Split horizontally"
          >
            <SplitSquareHorizontal size={14} className="text-white/80" />
          </button>
          
          <button
            onClick={() => onSplit('vertical')}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title="Split vertically"
          >
            <SplitSquareVertical size={14} className="text-white/80" />
          </button>
          
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 rounded hover:bg-white/20 transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <Minimize2 size={14} className="text-white/80" />
            ) : (
              <Maximize2 size={14} className="text-white/80" />
            )}
          </button>
          
          {canClose && (
            <>
              <div className="w-px h-4 bg-white/20 mx-1" />
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-red-500/50 transition-colors"
                title="Close pane"
              >
                <X size={14} className="text-white/80" />
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Active indicator */}
      <div 
        className={`
          absolute inset-0 pointer-events-none border-2 z-20
          transition-colors duration-200
          ${isActive ? '' : 'border-transparent'}
        `}
        style={{ 
          borderColor: isActive ? game.color : 'transparent'
        }}
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-pane-bg z-5">
          <div className="flex flex-col items-center gap-3">
            <div 
              className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${game.color}40`, borderTopColor: 'transparent' }}
            />
            <span className="text-gray-400 text-sm">Loading {game.name}...</span>
          </div>
        </div>
      )}
      
      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={pane.url}
        className="flex-1 bg-pane-bg"
        onLoad={() => setIsLoading(false)}
        title={`${game.name} - ${pane.id}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
      />
    </div>
  );
}
