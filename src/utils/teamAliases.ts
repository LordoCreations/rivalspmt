import fs from "node:fs";

export type TeamAliases = Record<string, string[]>;

const TEAMS_FILE_PATH = "data/teams.json";

function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

function cleanTeamName(name: string): string {
  return name.trim();
}

function getDefaultAliases(teamName: string): string[] {
  return [teamName];
}

function mergeAliases(teamName: string, aliases: string[]): string[] {
  const merged = [...aliases, ...getDefaultAliases(teamName)]
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

export function loadTeamAliases(): TeamAliases {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(TEAMS_FILE_PATH, "utf-8"),
    ) as unknown;

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const normalized: TeamAliases = {};

    for (const [teamName, aliases] of Object.entries(parsed as Record<string, unknown>)) {
      const existingAliases = Array.isArray(aliases)
        ? aliases.filter((alias): alias is string => typeof alias === "string")
        : [];
      normalized[teamName] = mergeAliases(teamName, existingAliases);
    }

    return normalized;
  } catch {
    return {};
  }
}

export function saveTeamAliases(teamAliases: TeamAliases): void {
  const normalized: TeamAliases = {};

  for (const [teamName, aliases] of Object.entries(teamAliases)) {
    normalized[teamName] = mergeAliases(teamName, aliases);
  }

  fs.writeFileSync(TEAMS_FILE_PATH, `${JSON.stringify(normalized, null, 2)}\n`);
}

function findTeamByAlias(matchTeamName: string, teamAliases: TeamAliases): string | null {
  const target = normalizeAlias(matchTeamName);

  for (const [teamName, aliases] of Object.entries(teamAliases)) {
    const hasAlias = aliases.some((alias) => normalizeAlias(alias) === target);
    if (hasAlias || normalizeAlias(teamName) === target) {
      return teamName;
    }
  }

  return null;
}

function findCanonicalTeamName(teamName: string, teamAliases: TeamAliases): string {
  const normalizedName = teamName.trim().toLowerCase();

  for (const existingTeamName of Object.keys(teamAliases)) {
    if (existingTeamName.trim().toLowerCase() === normalizedName) {
      return existingTeamName;
    }
  }

  return teamName;
}

export function resolveTeamNameFromAliases(
  matchTeamName: string,
  teamAliases: TeamAliases,
): string | null {
  return findTeamByAlias(matchTeamName, teamAliases);
}

export function addAliasForTeam(
  teamName: string,
  matchTeamName: string,
  teamAliases: TeamAliases,
): string {
  const canonicalTeamName = findCanonicalTeamName(teamName, teamAliases);

  const aliases = teamAliases[canonicalTeamName] ?? [];
  teamAliases[canonicalTeamName] = mergeAliases(canonicalTeamName, [
    ...aliases,
    matchTeamName,
    cleanTeamName(matchTeamName),
  ]);

  return canonicalTeamName;
}
