// Name generation utilities for cities and water bodies

const CITY_NAME_PARTS = [
  'Spring', 'Riverside', 'Harbor', 'Valley', 'Hill', 'Bay', 'Creek', 'Park',
  'Lake', 'Mountain', 'Beach', 'Forest', 'Bridge', 'Port', 'View', 'Heights',
  'Grove', 'Meadow', 'Ridge', 'Point', 'Falls', 'Brook', 'Pine', 'Oak',
  'Maple', 'Cedar', 'Elm', 'Willow', 'Ash', 'Birch', 'Green', 'Blue',
  'White', 'Black', 'Red', 'New', 'Old', 'East', 'West', 'North', 'South',
  'Grand', 'Little', 'Big', 'Upper', 'Lower', 'Central', 'Fair', 'Bright',
  'Sunny', 'Clear', 'Rock', 'Stone', 'Iron', 'Gold', 'Silver', 'Copper',
  'Mill', 'Town', 'City', 'Ville', 'Burg', 'Field', 'Land', 'Wood',
];

const CITY_SUFFIXES = [
  'City', 'Town', 'Ville', 'Burg', 'Port', 'Harbor', 'Bay', 'Beach',
  'Park', 'Heights', 'Hills', 'Valley', 'Ridge', 'Point', 'Falls',
  'Springs', 'Grove', 'Meadow', 'Field', 'Woods', 'Lake', 'River',
];

const WATER_NAMES = [
  // Lakes
  'Pine Lake', 'Crystal Lake', 'Emerald Lake', 'Blue Lake', 'Clear Lake',
  'Silver Lake', 'Golden Lake', 'Mountain Lake', 'Forest Lake', 'Sunset Lake',
  'Sunrise Lake', 'Moon Lake', 'Star Lake', 'Mirror Lake', 'Reflection Lake',
  'Tranquil Lake', 'Serene Lake', 'Peaceful Lake', 'Still Lake', 'Calm Lake',
  'Deep Lake', 'Shallow Lake', 'Hidden Lake', 'Secret Lake', 'Lost Lake',
  'Wild Lake', 'Bear Lake', 'Eagle Lake', 'Deer Lake', 'Wolf Lake',
  'Trout Lake', 'Bass Lake', 'Salmon Lake', 'Perch Lake', 'Pike Lake',
  'Lily Lake', 'Lotus Lake', 'Willow Lake', 'Oak Lake', 'Maple Lake',
  'Cedar Lake', 'Birch Lake', 'Pine Lake', 'Spruce Lake', 'Fir Lake',
  'Misty Lake', 'Foggy Lake', 'Cloudy Lake', 'Bright Lake', 'Shimmer Lake',
  'Sparkle Lake', 'Glitter Lake', 'Diamond Lake', 'Pearl Lake', 'Jade Lake',
  
  // Oceans/Seas
  'Pacific Ocean', 'Atlantic Ocean', 'Arctic Ocean', 'Indian Ocean',
  'Southern Ocean', 'Mediterranean Sea', 'Caribbean Sea', 'North Sea',
  'Baltic Sea', 'Black Sea', 'Red Sea', 'Caspian Sea', 'Aral Sea',
  'Bering Sea', 'Sea of Japan', 'East China Sea', 'South China Sea',
  'Yellow Sea', 'Philippine Sea', 'Coral Sea', 'Tasman Sea', 'Arabian Sea',
  'Bay of Bengal', 'Gulf of Mexico', 'Persian Gulf', 'Gulf of Alaska',
  'Hudson Bay', 'Baffin Bay', 'Davis Strait', 'Denmark Strait',
  'Great Bay', 'Grand Bay', 'Royal Bay', 'Majestic Bay', 'Noble Bay',
  'Ancient Sea', 'Eternal Sea', 'Endless Sea', 'Boundless Sea', 'Vast Sea',
];

export function generateCityName(): string {
  const part1 = CITY_NAME_PARTS[Math.floor(Math.random() * CITY_NAME_PARTS.length)];
  const part2 = CITY_NAME_PARTS[Math.floor(Math.random() * CITY_NAME_PARTS.length)];
  const suffix = CITY_SUFFIXES[Math.floor(Math.random() * CITY_SUFFIXES.length)];
  
  // Sometimes use two parts, sometimes one part + suffix
  if (Math.random() > 0.5) {
    return `${part1} ${suffix}`;
  } else {
    // Avoid duplicate parts
    if (part1 === part2) {
      return `${part1} ${suffix}`;
    }
    return `${part1}${part2} ${suffix}`;
  }
}

export function generateWaterName(type: 'lake' | 'ocean'): string {
  const filtered = WATER_NAMES.filter(name => {
    const lower = name.toLowerCase();
    if (type === 'lake') {
      return lower.includes('lake') || lower.includes('pond');
    } else {
      return lower.includes('ocean') || lower.includes('sea') || lower.includes('bay') || lower.includes('gulf') || lower.includes('strait');
    }
  });
  
  if (filtered.length === 0) {
    return type === 'lake' ? 'Lake' : 'Ocean';
  }
  
  return filtered[Math.floor(Math.random() * filtered.length)];
}
