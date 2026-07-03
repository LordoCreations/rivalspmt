import fs from "node:fs";
import path from "node:path";

import { Octokit } from "octokit";

interface DataFileConfig {
  gistFilename: string;
  localPath: string;
}

export interface PushDataResult {
  gistId: string;
  gistUrl: string;
  updatedFiles: string[];
}

const DEFAULT_GIST_ID = "5c84643574b1016cf8dd70eb7c309fc8";
const EMPTY_JSON_CONTENT = "{}\n";

const DATA_FILES: DataFileConfig[] = [
  { gistFilename: "heroes.json", localPath: "data/heroes.json" },
  { gistFilename: "maps.json", localPath: "data/maps.json" },
  { gistFilename: "players.json", localPath: "data/players.json" },
  { gistFilename: "teams.json", localPath: "data/teams.json" },
];

function getConfiguredGistId(): string {
  return (process.env.GITHUB_GIST_ID ?? DEFAULT_GIST_ID).trim();
}

function getEditToken(): string | null {
  const token =
    process.env.GIST_EDIT_KEY ??
    process.env.GITHUB_GIST_TOKEN ??
    process.env.GITHUB_TOKEN;

  if (typeof token !== "string") {
    return null;
  }

  const trimmedToken = token.trim();
  return trimmedToken.length > 0 ? trimmedToken : null;
}

function normalizeJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return null;
  }
}

function writeFile(localPath: string, content: string): void {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, content);
}

function ensureLocalJson(localPath: string): void {
  try {
    if (!fs.existsSync(localPath)) {
      writeFile(localPath, EMPTY_JSON_CONTENT);
      return;
    }

    const raw = fs.readFileSync(localPath, "utf-8");
    if (normalizeJson(raw) === null) {
      writeFile(localPath, EMPTY_JSON_CONTENT);
    }
  } catch {
    writeFile(localPath, EMPTY_JSON_CONTENT);
  }
}

function ensureAllLocalJsonFiles(): void {
  for (const file of DATA_FILES) {
    ensureLocalJson(file.localPath);
  }
}

function readLocalJson(localPath: string): string {
  try {
    const raw = fs.readFileSync(localPath, "utf-8");
    const normalized = normalizeJson(raw);

    if (normalized !== null) {
      return normalized;
    }
  } catch {
    // If reading fails, return empty JSON so sync can continue.
  }

  return EMPTY_JSON_CONTENT;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function uniqueAliases(aliases: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    merged.push(trimmed);
  }

  return merged;
}

function mergeAliasMaps(
  localObj: Record<string, unknown>,
  cloudObj: Record<string, unknown>,
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  const keys = new Set<string>([...Object.keys(localObj), ...Object.keys(cloudObj)]);

  for (const key of keys) {
    const localAliases = Array.isArray(localObj[key])
      ? (localObj[key] as unknown[]).filter((alias): alias is string => typeof alias === "string")
      : [];
    const cloudAliases = Array.isArray(cloudObj[key])
      ? (cloudObj[key] as unknown[]).filter((alias): alias is string => typeof alias === "string")
      : [];

    // Preserve local aliases and append any new cloud aliases.
    merged[key] = uniqueAliases([...localAliases, ...cloudAliases]);
  }

  return merged;
}

function mergeDataForPull(localPath: string, localRaw: string, cloudRaw: string): string {
  const localObj = parseJsonObject(localRaw);
  const cloudObj = parseJsonObject(cloudRaw);

  if (localObj === null && cloudObj === null) {
    return EMPTY_JSON_CONTENT;
  }

  if (localObj === null && cloudObj !== null) {
    return `${JSON.stringify(cloudObj, null, 2)}\n`;
  }

  if (localObj !== null && cloudObj === null) {
    return `${JSON.stringify(localObj, null, 2)}\n`;
  }

  const localData = localObj as Record<string, unknown>;
  const cloudData = cloudObj as Record<string, unknown>;

  if (localPath.endsWith("players.json") || localPath.endsWith("teams.json")) {
    const mergedAliases = mergeAliasMaps(localData, cloudData);
    return `${JSON.stringify(mergedAliases, null, 2)}\n`;
  }

  // Default object merge for heroes and future JSON files:
  // keep local values for existing keys, and add any missing cloud keys.
  const merged = { ...cloudData, ...localData };
  return `${JSON.stringify(merged, null, 2)}\n`;
}

async function readGistFileContent(file: {
  content?: string;
  raw_url?: string;
} | null | undefined): Promise<string | null> {
  if (typeof file?.content === "string") {
    return file.content;
  }

  if (typeof file?.raw_url === "string" && file.raw_url.length > 0) {
    try {
      const response = await fetch(file.raw_url, { method: "GET", redirect: "follow" });
      if (!response.ok) {
        return null;
      }

      return await response.text();
    } catch {
      return null;
    }
  }

  return null;
}

export async function syncDataFromCloudOnStart(): Promise<void> {
  ensureAllLocalJsonFiles();

  const gistId = getConfiguredGistId();
  if (gistId.length === 0) {
    return;
  }

  const octokit = new Octokit();

  try {
    const response = await octokit.rest.gists.get({ gist_id: gistId });
    const gistFiles = response.data.files ?? {};

    for (const file of DATA_FILES) {
      const cloudFile = gistFiles[file.gistFilename] ?? null;
      const cloudContent = await readGistFileContent(cloudFile);

      if (cloudContent === null) {
        ensureLocalJson(file.localPath);
        continue;
      }

      const normalized = normalizeJson(cloudContent);
      if (normalized === null) {
        ensureLocalJson(file.localPath);
        continue;
      }

      const localContent = readLocalJson(file.localPath);
      const mergedContent = mergeDataForPull(file.localPath, localContent, normalized);
      writeFile(file.localPath, mergedContent);
    }
  } catch {
    // Keep local files as the fallback when cloud sync fails.
    ensureAllLocalJsonFiles();
  }
}

export async function pushLocalDataToCloud(): Promise<PushDataResult> {
  ensureAllLocalJsonFiles();

  const token = getEditToken();
  if (token === null) {
    throw new Error(
      "Missing edit token. Set GIST_EDIT_KEY (or GITHUB_GIST_TOKEN / GITHUB_TOKEN) in .env.",
    );
  }

  const gistId = getConfiguredGistId();
  if (gistId.length === 0) {
    throw new Error("Missing GITHUB_GIST_ID. Provide it in .env or keep the default gist ID.");
  }

  const files: Record<string, { content: string }> = {};

  for (const file of DATA_FILES) {
    files[file.gistFilename] = { content: readLocalJson(file.localPath) };
  }

  const octokit = new Octokit({ auth: token });
  const response = await octokit.rest.gists.update({
    gist_id: gistId,
    files,
  });

  return {
    gistId,
    gistUrl: response.data.html_url ?? `https://gist.github.com/${gistId}`,
    updatedFiles: DATA_FILES.map((file) => file.gistFilename),
  };
}
