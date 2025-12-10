'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import NextImage from 'next/image';
import { Button } from '@/components/ui/button';
import { GameProvider } from '@/context/GameContext';
import Game from '@/components/Game';
import { useMobile } from '@/hooks/useMobile';
import { getSpritePack, getSpriteCoords, DEFAULT_SPRITE_PACK_ID } from '@/lib/renderConfig';
import { SavedCityMeta } from '@/types/game';
import { Building2, Map, Play, Sparkles, FolderOpen } from 'lucide-react';

const STORAGE_KEY = 'isocity-game-state';
const SAVED_CITIES_INDEX_KEY = 'isocity-saved-cities-index';

// Background color to filter from sprite sheets (red)
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
const COLOR_THRESHOLD = 155;

// Filter red background from sprite sheet
function filterBackgroundColor(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const distance = Math.sqrt(
      Math.pow(r - BACKGROUND_COLOR.r, 2) +
      Math.pow(g - BACKGROUND_COLOR.g, 2) +
      Math.pow(b - BACKGROUND_COLOR.b, 2)
    );
    
    if (distance <= COLOR_THRESHOLD) {
      data[i + 3] = 0; // Make transparent
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Animated city skyline background component
function CityBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/70 z-10" />
      
      {/* City image */}
      <div className="absolute inset-0 opacity-40">
        <NextImage 
          src="/games/IMG_6902.PNG" 
          alt="City preview"
          fill
          className="object-cover object-center scale-110"
          style={{ filter: 'blur(1px) saturate(0.8)' }}
          priority
        />
      </div>
      
      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
    </div>
  );
}

// Feature badge component
function FeatureBadge({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-white/60 text-sm">
      <Icon className="w-4 h-4" />
      <span>{text}</span>
    </div>
  );
}

// Check if there's a saved game in localStorage
function hasSavedGame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.grid && parsed.gridSize && parsed.stats;
    }
  } catch {
    return false;
  }
  return false;
}

// Load saved cities index from localStorage
function loadSavedCities(): SavedCityMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SAVED_CITIES_INDEX_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed as SavedCityMeta[];
      }
    }
  } catch {
    return [];
  }
  return [];
}

// Sprite Gallery component that renders sprites using canvas (like SpriteTestPanel)
function SpriteGallery({ count = 16, cols = 4, cellSize = 120 }: { count?: number; cols?: number; cellSize?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filteredSheet, setFilteredSheet] = useState<HTMLCanvasElement | null>(null);
  const spritePack = useMemo(() => getSpritePack(DEFAULT_SPRITE_PACK_ID), []);
  
  // Get random sprite keys from the sprite order, pre-validated to have valid coords
  const randomSpriteKeys = useMemo(() => {
    // Filter to only sprites that have valid building type mappings
    const validSpriteKeys = spritePack.spriteOrder.filter(spriteKey => {
      // Check if this sprite key has a building type mapping
      const hasBuildingMapping = Object.values(spritePack.buildingToSprite).includes(spriteKey);
      return hasBuildingMapping;
    });
    const shuffled = shuffleArray([...validSpriteKeys]);
    return shuffled.slice(0, count);
  }, [spritePack.spriteOrder, spritePack.buildingToSprite, count]);
  
  // Load and filter sprite sheet
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const filtered = filterBackgroundColor(img);
      setFilteredSheet(filtered);
    };
    img.src = spritePack.src;
  }, [spritePack.src]);
  
  // Pre-compute sprite data with valid coords
  const spriteData = useMemo(() => {
    if (!filteredSheet) return [];
    
    const sheetWidth = filteredSheet.width;
    const sheetHeight = filteredSheet.height;
    
    return randomSpriteKeys.map(spriteKey => {
      const buildingType = Object.entries(spritePack.buildingToSprite).find(
        ([, value]) => value === spriteKey
      )?.[0] || spriteKey;
      
      const coords = getSpriteCoords(buildingType, sheetWidth, sheetHeight, spritePack);
      return coords ? { spriteKey, coords } : null;
    }).filter((item): item is { spriteKey: string; coords: { sx: number; sy: number; sw: number; sh: number } } => item !== null);
  }, [filteredSheet, randomSpriteKeys, spritePack]);
  
  // Draw sprites to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !filteredSheet || spriteData.length === 0) return;
    
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rows = Math.ceil(spriteData.length / cols);
    const padding = 10;
    
    const canvasWidth = cols * cellSize;
    const canvasHeight = rows * cellSize;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;
    
    // Clear canvas (transparent)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw each sprite
    spriteData.forEach(({ coords }, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const cellX = col * cellSize;
      const cellY = row * cellSize;
      
      // Draw cell background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cellX + 2, cellY + 2, cellSize - 4, cellSize - 4, 4);
      ctx.fill();
      ctx.stroke();
      
      // Calculate destination size preserving aspect ratio
      const maxSize = cellSize - padding * 2;
      const aspectRatio = coords.sh / coords.sw;
      let destWidth = maxSize;
      let destHeight = destWidth * aspectRatio;
      
      if (destHeight > maxSize) {
        destHeight = maxSize;
        destWidth = destHeight / aspectRatio;
      }
      
      // Center sprite in cell
      const drawX = cellX + (cellSize - destWidth) / 2;
      const drawY = cellY + (cellSize - destHeight) / 2 + destHeight * 0.1; // Slight offset down
      
      // Draw sprite
      ctx.drawImage(
        filteredSheet,
        coords.sx, coords.sy, coords.sw, coords.sh,
        Math.round(drawX), Math.round(drawY),
        Math.round(destWidth), Math.round(destHeight)
      );
    });
  }, [filteredSheet, spriteData, cols, cellSize]);
  
  return (
    <canvas
      ref={canvasRef}
      className="opacity-80 hover:opacity-100 transition-opacity"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// Saved City Card Component
function SavedCityCard({ city, onLoad }: { city: SavedCityMeta; onLoad: () => void }) {
  return (
    <button
      onClick={onLoad}
      className="w-full text-left p-4 bg-gradient-to-br from-white/5 to-white/[0.02] hover:from-white/10 hover:to-white/5 border border-white/10 hover:border-blue-500/30 rounded-lg transition-all duration-300 group hover:shadow-lg hover:shadow-blue-500/5"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate group-hover:text-blue-300 transition-colors text-sm">
            {city.cityName}
          </h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-green-400/60 rounded-full" />
              {city.population.toLocaleString()}
            </span>
            <span className="text-emerald-400/70">${city.money.toLocaleString()}</span>
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-4 h-4 text-blue-400" />
        </div>
      </div>
    </button>
  );
}

const SAVED_CITY_PREFIX = 'isocity-city-';

export default function HomePage() {
  const [showGame, setShowGame] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [savedCities, setSavedCities] = useState<SavedCityMeta[]>([]);
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobile = isMobileDevice || isSmallScreen;

  // Check for saved game after mount (client-side only)
  useEffect(() => {
    const checkSavedGame = () => {
      setIsChecking(false);
      setSavedCities(loadSavedCities());
      if (hasSavedGame()) {
        setShowGame(true);
      }
    };
    // Use requestAnimationFrame to avoid synchronous setState in effect
    requestAnimationFrame(checkSavedGame);
  }, []);

  // Handle exit from game - refresh saved cities list
  const handleExitGame = () => {
    setShowGame(false);
    setSavedCities(loadSavedCities());
  };

  // Load a saved city
  const loadSavedCity = (cityId: string) => {
    try {
      const saved = localStorage.getItem(SAVED_CITY_PREFIX + cityId);
      if (saved) {
        localStorage.setItem(STORAGE_KEY, saved);
        setShowGame(true);
      }
    } catch {
      console.error('Failed to load saved city');
    }
  };

  if (isChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </main>
    );
  }

  if (showGame) {
    return (
      <GameProvider>
        <main className="h-screen w-screen overflow-hidden">
          <Game onExit={handleExitGame} />
        </main>
      </GameProvider>
    );
  }

  // Mobile landing page
  if (isMobile) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom overflow-y-auto relative">
        <CityBackground />
        
        <div className="relative z-20 flex flex-col items-center w-full max-w-sm">
          {/* Logo and Title */}
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-10 h-10 text-blue-400" />
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
              IsoCity
            </h1>
          </div>
          
          {/* Tagline */}
          <p className="text-white/50 text-sm mb-6 text-center">
            Build your dream metropolis
          </p>
          
          {/* Sprite Gallery */}
          <div className="mb-6 p-3 bg-black/30 rounded-xl border border-white/5 backdrop-blur-sm">
            <SpriteGallery count={9} cols={3} cellSize={72} />
          </div>
          
          {/* Buttons */}
          <div className="flex flex-col gap-3 w-full">
            <Button 
              onClick={() => setShowGame(true)}
              className="w-full py-6 text-xl font-semibold tracking-wide bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-5 h-5 mr-2" />
              New City
            </Button>
            
            <Button 
              onClick={async () => {
                const { default: exampleState } = await import('@/resources/example_state_8.json');
                localStorage.setItem(STORAGE_KEY, JSON.stringify(exampleState));
                setShowGame(true);
              }}
              variant="outline"
              className="w-full py-6 text-lg font-medium tracking-wide bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300"
            >
              <Map className="w-5 h-5 mr-2" />
              Explore Demo City
            </Button>
          </div>
          
          {/* Saved Cities */}
          {savedCities.length > 0 && (
            <div className="w-full mt-6">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="w-4 h-4 text-white/40" />
                <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Your Cities
                </h2>
              </div>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {savedCities.slice(0, 5).map((city) => (
                  <SavedCityCard
                    key={city.id}
                    city={city}
                    onLoad={() => loadSavedCity(city.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Desktop landing page
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-8 relative overflow-hidden">
      <CityBackground />
      
      <div className="relative z-20 max-w-6xl w-full">
        {/* Main content card */}
        <div className="grid lg:grid-cols-5 gap-8 items-center">
          
          {/* Left - Title and Buttons (3 cols) */}
          <div className="lg:col-span-3 flex flex-col items-center lg:items-start justify-center">
            {/* Logo and Title */}
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30">
                <Building2 className="w-12 h-12 text-blue-400" />
              </div>
              <div>
                <h1 className="text-7xl lg:text-8xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                  IsoCity
                </h1>
              </div>
            </div>
            
            {/* Tagline */}
            <p className="text-white/60 text-xl mb-4 text-center lg:text-left max-w-md">
              Design and build your dream metropolis in stunning isometric style
            </p>
            
            {/* Feature badges */}
            <div className="flex flex-wrap gap-2 mb-8 justify-center lg:justify-start">
              <FeatureBadge icon={Building2} text="100+ Buildings" />
              <FeatureBadge icon={Map} text="Dynamic Simulation" />
              <FeatureBadge icon={Sparkles} text="Beautiful Graphics" />
            </div>
            
            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button 
                onClick={() => setShowGame(true)}
                className="px-8 py-7 text-xl font-semibold tracking-wide bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] min-w-[200px]"
              >
                <Play className="w-6 h-6 mr-2" />
                New City
              </Button>
              <Button 
                onClick={async () => {
                  const { default: exampleState } = await import('@/resources/example_state_8.json');
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(exampleState));
                  setShowGame(true);
                }}
                variant="outline"
                className="px-8 py-7 text-xl font-medium tracking-wide bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300 min-w-[200px]"
              >
                <Map className="w-6 h-6 mr-2" />
                Demo City
              </Button>
            </div>
            
            {/* Saved Cities */}
            {savedCities.length > 0 && (
              <div className="w-full max-w-md mt-8">
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="w-4 h-4 text-white/40" />
                  <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                    Your Cities
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                  {savedCities.slice(0, 6).map((city) => (
                    <SavedCityCard
                      key={city.id}
                      city={city}
                      onLoad={() => loadSavedCity(city.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right - Sprite Gallery (2 cols) */}
          <div className="lg:col-span-2 flex justify-center lg:justify-end">
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-sm shadow-2xl">
              <SpriteGallery count={16} cols={4} cellSize={100} />
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-white/30 text-sm">
            Press <kbd className="px-2 py-1 bg-white/5 rounded text-white/50">Esc</kbd> at any time to access menu • Use <kbd className="px-2 py-1 bg-white/5 rounded text-white/50">B</kbd> for bulldozer
          </p>
        </div>
      </div>
    </main>
  );
}
