// Generates a consistent, unique color for each city based on its name.
// Same city name always produces the same color, regardless of traveler.

const CITY_PALETTE = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#D946EF', // fuchsia
  '#0EA5E9', // sky
  '#E11D48', // rose
  '#A855F7', // purple
  '#22C55E', // green
  '#FACC15', // yellow
  '#2DD4BF', // teal-light
  '#FB923C', // orange-light
  '#818CF8', // indigo-light
];

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

const cityColorCache = new Map<string, string>();
const usedIndices = new Set<number>();

export function getCityColor(cityName: string): string {
  const key = cityName.toLowerCase().trim();
  if (cityColorCache.has(key)) {
    return cityColorCache.get(key)!;
  }

  let index = hashString(key) % CITY_PALETTE.length;

  // Resolve collisions by probing next available slot
  let attempts = 0;
  while (usedIndices.has(index) && attempts < CITY_PALETTE.length) {
    index = (index + 1) % CITY_PALETTE.length;
    attempts++;
  }

  usedIndices.add(index);
  const color = CITY_PALETTE[index];
  cityColorCache.set(key, color);
  return color;
}
