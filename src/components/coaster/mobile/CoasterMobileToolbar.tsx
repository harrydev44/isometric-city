'use client';

import React, { useState, useCallback } from 'react';
import { useCoaster } from '@/context/CoasterContext';
import { Tool, TOOL_INFO } from '@/games/coaster/types';
import { COASTER_TYPE_STATS, getCoasterCategory } from '@/games/coaster/types/tracks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// =============================================================================
// ICONS
// =============================================================================

function CloseIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4l16 8-8 3-3 8z" />
    </svg>
  );
}

function BulldozeIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M6 6v14a2 2 0 002 2h8a2 2 0 002-2V6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </svg>
  );
}

function PathIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19L12 5L20 19" />
      <path d="M7 14h10" />
    </svg>
  );
}

function CoasterIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 18c0-3 2-6 6-6s6 3 6 6" />
      <circle cx="4" cy="18" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M14 12c2-2 4-2 6 0" />
      <circle cx="16" cy="14" r="1.5" />
    </svg>
  );
}

function RideIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20M2 12h20" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8h1a4 4 0 010 8h-1" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function TreeIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22V8" />
      <path d="M5 12h14l-7-8-7 8z" />
      <path d="M6 16h12l-6-7-6 7z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

// =============================================================================
// TOOL CATEGORIES FOR MOBILE MENU
// =============================================================================

const toolCategories = {
  'TOOLS': ['select', 'bulldoze'] as Tool[],
  'PATHS': ['path', 'queue'] as Tool[],
  'TERRAIN': ['zone_water', 'zone_land'] as Tool[],
  'WOODEN COASTERS': [
    'coaster_type_wooden_classic',
    'coaster_type_wooden_twister',
  ] as Tool[],
  'STEEL COASTERS': [
    'coaster_type_steel_sit_down',
    'coaster_type_steel_standup',
    'coaster_type_steel_inverted',
    'coaster_type_steel_floorless',
    'coaster_type_steel_wing',
    'coaster_type_steel_flying',
    'coaster_type_steel_4d',
    'coaster_type_steel_spinning',
    'coaster_type_launch_coaster',
    'coaster_type_hyper_coaster',
    'coaster_type_giga_coaster',
  ] as Tool[],
  'SPECIALTY COASTERS': [
    'coaster_type_water_coaster',
    'coaster_type_mine_train',
    'coaster_type_bobsled',
    'coaster_type_suspended',
  ] as Tool[],
  'COASTER TRACK': [
    'coaster_build',
    'coaster_track',
    'coaster_turn_left',
    'coaster_turn_right',
    'coaster_slope_up',
    'coaster_slope_down',
    'coaster_loop',
    'coaster_station',
  ] as Tool[],
  'SMALL RIDES': [
    'ride_kiddie_coaster', 'ride_kiddie_train', 'ride_kiddie_planes', 'ride_kiddie_boats', 'ride_kiddie_cars',
    'ride_teacups', 'ride_scrambler', 'ride_tilt_a_whirl', 'ride_spinning_apples', 'ride_whirlwind',
    'ride_carousel', 'ride_antique_cars',
    'ride_bumper_cars', 'ride_go_karts', 'ride_simulator',
    'ride_bumper_boats', 'ride_paddle_boats', 'ride_lazy_river',
    'ride_haunted_house', 'ride_ghost_train', 'ride_dark_ride',
  ] as Tool[],
  'LARGE RIDES': [
    'ride_ferris_classic', 'ride_ferris_modern', 'ride_ferris_observation',
    'ride_drop_tower', 'ride_space_shot', 'ride_observation_tower', 'ride_star_flyer',
    'ride_swing_ride', 'ride_wave_swinger', 'ride_flying_scooters',
    'ride_top_spin', 'ride_frisbee', 'ride_afterburner',
    'ride_log_flume', 'ride_rapids',
  ] as Tool[],
  'FOOD & DRINK': [
    'food_hotdog', 'food_burger', 'food_fries', 'food_icecream', 'food_cotton_candy',
    'drink_soda', 'drink_lemonade', 'drink_smoothie', 'drink_coffee',
    'snack_popcorn', 'snack_nachos', 'snack_pizza',
  ] as Tool[],
  'SHOPS & SERVICES': [
    'shop_souvenir', 'shop_emporium', 'shop_photo', 'shop_toys', 'shop_plush',
    'game_ring_toss', 'game_balloon', 'game_shooting',
    'restroom', 'first_aid', 'lockers', 'atm',
  ] as Tool[],
  'SCENERY': [
    'tree_oak', 'tree_maple', 'tree_pine', 'tree_palm', 'tree_cherry',
    'bush_hedge', 'bush_flowering', 'topiary_ball',
    'flowers_bed', 'flowers_planter', 'flowers_wild',
    'bench_wooden', 'bench_metal', 'lamp_victorian', 'lamp_modern',
    'trash_can_basic', 'trash_can_fancy',
    'fountain_small_1', 'fountain_medium_1', 'fountain_large_1',
    'pond_small', 'pond_medium',
  ] as Tool[],
  'INFRASTRUCTURE': ['park_entrance', 'staff_building'] as Tool[],
};

// Map coaster type tools to their CoasterType values
const COASTER_TYPE_TOOL_MAP: Record<string, string> = {
  'coaster_type_wooden_classic': 'wooden_classic',
  'coaster_type_wooden_twister': 'wooden_twister',
  'coaster_type_steel_sit_down': 'steel_sit_down',
  'coaster_type_steel_standup': 'steel_standup',
  'coaster_type_steel_inverted': 'steel_inverted',
  'coaster_type_steel_floorless': 'steel_floorless',
  'coaster_type_steel_wing': 'steel_wing',
  'coaster_type_steel_flying': 'steel_flying',
  'coaster_type_steel_4d': 'steel_4d',
  'coaster_type_steel_spinning': 'steel_spinning',
  'coaster_type_launch_coaster': 'launch_coaster',
  'coaster_type_hyper_coaster': 'hyper_coaster',
  'coaster_type_giga_coaster': 'giga_coaster',
  'coaster_type_water_coaster': 'water_coaster',
  'coaster_type_mine_train': 'mine_train',
  'coaster_type_bobsled': 'bobsled',
  'coaster_type_suspended': 'suspended',
};

// Primary colors for each coaster type
const COASTER_TYPE_PRIMARY_COLORS: Record<string, string> = {
  wooden_classic: '#8B4513',
  wooden_twister: '#A0522D',
  steel_sit_down: '#dc2626',
  steel_standup: '#7c3aed',
  steel_inverted: '#2563eb',
  steel_floorless: '#059669',
  steel_wing: '#ea580c',
  steel_flying: '#0891b2',
  steel_4d: '#be123c',
  steel_spinning: '#65a30d',
  launch_coaster: '#e11d48',
  hyper_coaster: '#0d9488',
  giga_coaster: '#4f46e5',
  water_coaster: '#0ea5e9',
  mine_train: '#92400e',
  bobsled: '#1d4ed8',
  suspended: '#b45309',
};

// =============================================================================
// COMPONENT
// =============================================================================

interface CoasterMobileToolbarProps {
  onOpenPanel: (panel: 'finances' | 'guests' | 'rides' | 'staff' | 'settings') => void;
}

export function CoasterMobileToolbar({ onOpenPanel }: CoasterMobileToolbarProps) {
  const { state, setTool, startCoasterBuild, cancelCoasterBuild } = useCoaster();
  const { selectedTool, finances, buildingCoasterType } = state;
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleCategoryClick = useCallback((category: string) => {
    setExpandedCategory(prev => prev === category ? null : category);
  }, []);

  const handleToolSelect = useCallback((tool: Tool, closeMenu: boolean = false) => {
    // Check if this is a coaster type selection tool
    const coasterType = COASTER_TYPE_TOOL_MAP[tool];
    if (coasterType) {
      // Start building a coaster of this type
      startCoasterBuild(coasterType);
      // Switch to coaster build mode
      setTool('coaster_build');
    } else {
      // Toggle tool selection
      if (selectedTool === tool && tool !== 'select') {
        setTool('select');
      } else {
        setTool(tool);
      }
    }
    setExpandedCategory(null);
    if (closeMenu) {
      setShowMenu(false);
    }
  }, [selectedTool, setTool, startCoasterBuild]);

  return (
    <>
      {/* Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        <Card className="rounded-none border-x-0 border-b-0 bg-card/95 backdrop-blur-sm">
          {/* Active coaster type indicator */}
          {buildingCoasterType && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-sidebar-border/50 bg-primary/10">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COASTER_TYPE_PRIMARY_COLORS[buildingCoasterType] ?? '#dc2626' }}
                />
                <span className="text-xs font-medium text-primary">
                  {COASTER_TYPE_STATS[buildingCoasterType]?.name ?? 'Custom Coaster'}
                </span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  ({getCoasterCategory(buildingCoasterType)})
                </span>
              </div>
              <button
                onClick={() => {
                  cancelCoasterBuild();
                  setTool('select');
                }}
                className="text-muted-foreground hover:text-destructive p-1"
                title="Cancel coaster build"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          )}
          
          {/* Selected tool info */}
          {selectedTool && TOOL_INFO[selectedTool] && !buildingCoasterType && (
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-sidebar-border/50 bg-secondary/30 text-xs">
              <span className="text-foreground font-medium">
                {TOOL_INFO[selectedTool].name}
              </span>
              {TOOL_INFO[selectedTool].cost > 0 && (
                <span className={`font-mono ${finances.cash >= TOOL_INFO[selectedTool].cost ? 'text-green-400' : 'text-red-400'}`}>
                  ${TOOL_INFO[selectedTool].cost}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-around px-2 py-2 gap-1">
            {/* Quick access tools */}
            <Button
              variant={selectedTool === 'select' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('select')}
            >
              <SelectIcon />
            </Button>

            <Button
              variant={selectedTool === 'bulldoze' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11 text-red-400"
              onClick={() => handleToolSelect('bulldoze')}
            >
              <BulldozeIcon />
            </Button>

            <Button
              variant={selectedTool === 'path' ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => handleToolSelect('path')}
            >
              <PathIcon />
            </Button>

            <Button
              variant={buildingCoasterType ? 'default' : 'ghost'}
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                setShowMenu(true);
                setExpandedCategory('WOODEN COASTERS');
              }}
            >
              <CoasterIcon />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                setShowMenu(true);
                setExpandedCategory('SMALL RIDES');
              }}
            >
              <RideIcon />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                setShowMenu(true);
                setExpandedCategory('FOOD & DRINK');
              }}
            >
              <FoodIcon />
            </Button>

            {/* More tools menu button */}
            <Button
              variant={showMenu ? 'default' : 'secondary'}
              size="icon"
              className="h-11 w-11"
              onClick={() => setShowMenu(!showMenu)}
            >
              {showMenu ? <CloseIcon size={20} /> : <MoreIcon />}
            </Button>
          </div>
        </Card>
      </div>

      {/* Expanded Tool Menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setShowMenu(false)}>
          <Card
            className="absolute bottom-20 left-2 right-2 max-h-[70vh] overflow-hidden rounded-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Park Management section at top */}
            <div className="p-3 border-b border-border flex-shrink-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Park Management
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('finances'); setShowMenu(false); }}
                >
                  Finances
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('rides'); setShowMenu(false); }}
                >
                  Rides
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('guests'); setShowMenu(false); }}
                >
                  Guests
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-full text-xs"
                  onClick={() => { onOpenPanel('settings'); setShowMenu(false); }}
                >
                  Settings
                </Button>
              </div>
            </div>

            {/* Active coaster track tools (when building) */}
            {buildingCoasterType && (
              <div className="p-3 border-b border-border flex-shrink-0 bg-primary/5">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Track Tools
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(['coaster_track', 'coaster_turn_left', 'coaster_turn_right', 'coaster_slope_up', 'coaster_slope_down', 'coaster_loop', 'coaster_station'] as Tool[]).map(tool => {
                    const info = TOOL_INFO[tool];
                    if (!info) return null;
                    const isSelected = selectedTool === tool;
                    const canAfford = finances.cash >= info.cost;
                    
                    return (
                      <Button
                        key={tool}
                        variant={isSelected ? 'default' : 'ghost'}
                        size="sm"
                        className="h-9 w-full text-[10px] px-1"
                        disabled={!canAfford && info.cost > 0}
                        onClick={() => handleToolSelect(tool, false)}
                      >
                        {info.name.replace('Track: ', '')}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-2 space-y-1 pb-4">
                {/* Category buttons */}
                {Object.entries(toolCategories).map(([category, tools]) => (
                  <div key={category}>
                    <Button
                      variant={expandedCategory === category ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => handleCategoryClick(category)}
                    >
                      <span className="flex-1 text-left font-medium">{category}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedCategory === category ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </Button>

                    {/* Expanded tools */}
                    {expandedCategory === category && (
                      <div className="pl-4 py-1 space-y-0.5">
                        {tools.map((tool) => {
                          const info = TOOL_INFO[tool];
                          if (!info) return null;
                          const canAfford = finances.cash >= info.cost;
                          const isCoasterType = COASTER_TYPE_TOOL_MAP[tool];
                          const isSelected = isCoasterType 
                            ? buildingCoasterType === COASTER_TYPE_TOOL_MAP[tool]
                            : selectedTool === tool;

                          return (
                            <Button
                              key={tool}
                              variant={isSelected ? 'default' : 'ghost'}
                              className="w-full justify-start gap-3 h-11"
                              disabled={!canAfford && info.cost > 0}
                              onClick={() => handleToolSelect(tool, true)}
                            >
                              {isCoasterType && (
                                <div 
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: COASTER_TYPE_PRIMARY_COLORS[COASTER_TYPE_TOOL_MAP[tool]] ?? '#dc2626' }}
                                />
                              )}
                              <span className="flex-1 text-left">{info.name}</span>
                              {info.cost > 0 && (
                                <span className={`text-xs font-mono ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                                  ${info.cost.toLocaleString()}
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

export default CoasterMobileToolbar;
