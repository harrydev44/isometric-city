import { Home, Waypoints, Plus } from 'lucide-react';
import type { GameType } from '../types';
import { GAME_LIST } from '../games';

interface SidebarProps {
  activeGame: GameType | null;
  onSelectGame: () => void;
  onAddPane: (gameType: GameType) => void;
}

const iconMap = {
  home: Home,
  ferrisWheel: Waypoints,
};

export function Sidebar({ activeGame, onSelectGame, onAddPane }: SidebarProps) {
  return (
    <div className="w-14 bg-sidebar-bg border-r border-sidebar-border flex flex-col items-center py-3 gap-2">
      {/* Game Icons */}
      <div className="flex flex-col gap-2">
        {GAME_LIST.map((game) => {
          const Icon = iconMap[game.icon];
          const isActive = activeGame === game.id;
          
          return (
            <div key={game.id} className="relative group">
              <button
                onClick={() => onSelectGame()}
                onDoubleClick={() => onAddPane(game.id)}
                className={`
                  w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200
                  ${isActive 
                    ? 'bg-sidebar-active' 
                    : 'bg-transparent hover:bg-sidebar-hover'
                  }
                `}
                style={{
                  borderLeft: isActive ? `3px solid ${game.color}` : '3px solid transparent',
                }}
              >
                <Icon 
                  size={22} 
                  className="transition-colors duration-200"
                  style={{ color: isActive ? game.color : '#9ca3af' }}
                />
              </button>
              
              {/* Tooltip */}
              <div className="
                absolute left-full top-1/2 -translate-y-1/2 ml-2
                px-2 py-1 rounded bg-gray-800 text-white text-xs whitespace-nowrap
                opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity
                z-50
              ">
                {game.name}
                <span className="text-gray-400 ml-1">(double-click to add)</span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Separator */}
      <div className="w-8 h-px bg-sidebar-border my-2" />
      
      {/* Add New Pane */}
      <div className="relative group">
        <button
          onClick={() => onAddPane(activeGame || 'iso-city')}
          className="w-10 h-10 rounded-lg flex items-center justify-center 
                     bg-transparent hover:bg-sidebar-hover transition-all duration-200"
        >
          <Plus size={20} className="text-gray-400 hover:text-white transition-colors" />
        </button>
        
        {/* Tooltip */}
        <div className="
          absolute left-full top-1/2 -translate-y-1/2 ml-2
          px-2 py-1 rounded bg-gray-800 text-white text-xs whitespace-nowrap
          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity
          z-50
        ">
          Add new pane
        </div>
      </div>
    </div>
  );
}
