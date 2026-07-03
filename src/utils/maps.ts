import fs from "node:fs";

export interface Map {
  gameMode: string;
  id: string;
  name: string;
  mapIds: number[];
}

interface MapJsonEntry {
  gameMode: string;
  mapIds: number[];
  name: string;
}

function readMapsJson(): Record<string, MapJsonEntry> {
  const raw = fs.readFileSync("data/maps.json", "utf-8");
  return JSON.parse(raw) as Record<string, MapJsonEntry>;
}

function toMapEntries(mapData: Record<string, MapJsonEntry>): Map[] {
  return Object.entries(mapData).map(([id, entry]) => ({
    id,
    name: entry.name,
    mapIds: entry.mapIds,
    gameMode: entry.gameMode,
  }));
}

let cachedMaps: Map[] | null = null;

export function getMaps(): Map[] {
  if (cachedMaps === null) {
    cachedMaps = toMapEntries(readMapsJson());
  }

  return cachedMaps;
}

export function idToMap(id: number): Map {
  for (const map of getMaps()) {
    if (map.mapIds.includes(id)) {
      return map;
    }
  }

  throw new Error(`Map with ID ${id} not found`);
}
