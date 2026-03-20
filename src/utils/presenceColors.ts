const PRESENCE_PALETTE = [
  '#F87171', // red-400
  '#60A5FA', // blue-400
  '#34D399', // emerald-400
  '#FBBF24', // amber-400
  '#A78BFA', // violet-400
  '#F472B6', // pink-400
  '#22D3EE', // cyan-400
  '#FB923C', // orange-400
  '#2DD4BF', // teal-400
  '#818CF8', // indigo-400
  '#A3E635', // lime-400
  '#E879F9', // fuchsia-400
];

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

export function assignColorIndex(sessionId: string, existingIndices: number[]): number {
  const taken = new Set(existingIndices);
  let index = hashString(sessionId) % PRESENCE_PALETTE.length;

  let attempts = 0;
  while (taken.has(index) && attempts < PRESENCE_PALETTE.length) {
    index = (index + 1) % PRESENCE_PALETTE.length;
    attempts++;
  }

  return index;
}

export function getPresenceColor(index: number): string {
  return PRESENCE_PALETTE[index % PRESENCE_PALETTE.length];
}
