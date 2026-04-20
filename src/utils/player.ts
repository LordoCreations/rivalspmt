import fs from "node:fs";

const HEROES_FILE_URL = new URL("../../data/heroes.json", import.meta.url);
type HeroTuple = [string, number];
type HeroStore = Record<string, HeroTuple | string>;
let heroDataCache: HeroStore | null = null;

function loadHeroData(): HeroStore {
  if (heroDataCache !== null) {
    return heroDataCache;
  }

  try {
    const raw = fs.readFileSync(HEROES_FILE_URL, "utf-8");
    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      heroDataCache = parsed as HeroStore;
      return heroDataCache;
    }
  } catch {
    // Keep empty fallback when heroes.json does not exist or is invalid.
  }

  heroDataCache = {};
  return heroDataCache;
}

const ensure = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
};


export class PlayedHero {
  id: number;
  name: string;
  playtime: number;
  role: number; // 0 - Van, 1 - DPS, 2 - Strat

  constructor(id: number, playtime: number) {
    this.id = id;
    this.playtime = playtime;
    [this.name, this.role] = PlayedHero.getHeroDataFromID(id);
  }

  static compare(a: PlayedHero, b: PlayedHero) {
    return b.playtime - a.playtime;
  }

  static getHeroDataFromID(id: number): [string, number] {
    const heroJSON = loadHeroData();
    const heroStr = ensure(
      heroJSON[String(id)],
      `Hero ${id} not found`
    );
    const hero = typeof heroStr === 'string' ? JSON.parse(heroStr) : heroStr;
    return [hero[0], hero[1]];
  }
  
  /**
   * summary of heroes played by playtime
   * @param heroes array of heroes played sorted by descending playtime
   * @param totalTime total amount of time
   * @returns top 1/2 heroes
   */
  static calcHeroSum(heroes: PlayedHero[], totalTime: number): string {
    if (heroes[0].playtime > totalTime * 0.8) return heroes[0].name
    return `${heroes[0].name ?? ""} / ${heroes[1].name ?? ""}`
  }
}

export interface Player {
  uid: string;
  name: string;
  heroSum: string;
  heroes: PlayedHero[];
  k: number;
  d: number;
  a: number;
  last_kill: number;
}

export function cleanPlayerName(name: string): string {
  return name.replace(/(?<!\.)\.$/, "").trim();
}

export function comparePlayersForScoreboard(a: Player, b: Player): number {
  if (a.heroes[0].role != b.heroes[0].role) return a.heroes[0].role - b.heroes[0].role
  else return a.heroes[0].name.localeCompare(b.heroes[0].name)
}