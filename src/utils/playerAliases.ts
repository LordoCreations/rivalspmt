import fs from "node:fs";

import { cleanPlayerName } from "./player.ts";

export type PlayerAliases = Record<string, string[]>;

const PLAYERS_FILE_PATH = "data/players.json";

function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

function getDefaultAliases(playerName: string): string[] {
  return [playerName, `${playerName}.`];
}

function mergeAliases(playerName: string, aliases: string[]): string[] {
  const merged = [...aliases, ...getDefaultAliases(playerName)]
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const alias of merged) {
    const normalized = normalizeAlias(alias);
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }

    unique.push(alias);
    seen.add(normalized);
  }

  return unique;
}

export function loadPlayerAliases(): PlayerAliases {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(PLAYERS_FILE_PATH, "utf-8"),
    ) as unknown;

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const normalized: PlayerAliases = {};

    for (const [playerName, aliases] of Object.entries(parsed as Record<string, unknown>)) {
      const existingAliases = Array.isArray(aliases)
        ? aliases.filter((alias): alias is string => typeof alias === "string")
        : [];
      normalized[playerName] = mergeAliases(playerName, existingAliases);
    }

    return normalized;
  } catch {
    return {};
  }
}

export function savePlayerAliases(playerAliases: PlayerAliases): void {
  const normalized: PlayerAliases = {};

  for (const [playerName, aliases] of Object.entries(playerAliases)) {
    normalized[playerName] = mergeAliases(playerName, aliases);
  }

  fs.writeFileSync(PLAYERS_FILE_PATH, `${JSON.stringify(normalized, null, 2)}\n`);
}

function findPlayerByAlias(matchName: string, playerAliases: PlayerAliases): string | null {
  const target = normalizeAlias(matchName);

  for (const [playerName, aliases] of Object.entries(playerAliases)) {
    const hasAlias = aliases.some((alias) => normalizeAlias(alias) === target);
    if (hasAlias || normalizeAlias(playerName) === target) {
      return playerName;
    }
  }

  return null;
}

function findCanonicalPlayerName(playerName: string, playerAliases: PlayerAliases): string {
  const normalizedName = playerName.trim().toLowerCase();

  for (const existingPlayerName of Object.keys(playerAliases)) {
    if (existingPlayerName.trim().toLowerCase() === normalizedName) {
      return existingPlayerName;
    }
  }

  return playerName;
}

export function resolvePlayerNameFromAliases(
  matchName: string,
  playerAliases: PlayerAliases,
): string | null {
  return findPlayerByAlias(matchName, playerAliases);
}

export function addAliasForPlayer(
  playerName: string,
  matchName: string,
  playerAliases: PlayerAliases,
): string {
  const canonicalPlayerName = findCanonicalPlayerName(playerName, playerAliases);

  const aliases = playerAliases[canonicalPlayerName] ?? [];
  playerAliases[canonicalPlayerName] = mergeAliases(canonicalPlayerName, [
    ...aliases,
    matchName,
    cleanPlayerName(matchName),
  ]);

  return canonicalPlayerName;
}
