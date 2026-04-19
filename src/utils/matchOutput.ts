import { URLSearchParams } from "node:url";
import fs from "node:fs";
import Handlebars from "handlebars";

import { cleanPlayerName, comparePlayersForScoreboard, PlayedHero, type Player } from "./player.ts";
import { idToMap, type Map } from "./maps.ts";
import {
  addAliasForPlayer,
  resolvePlayerNameFromAliases,
  type PlayerAliases,
} from "./playerAliases.ts";
import {
  addAliasForTeam,
  resolveTeamNameFromAliases,
  type TeamAliases,
} from "./teamAliases.ts";

const ENDPOINT =
  "https://interact32-h.webapp.easebar.com/x20namwss202505/x20mwss202505_get_history_by_replay_id/";

const matchTemplateSource = fs.readFileSync(
  "templates/maptemplate.md",
  "utf-8",
);

const matchTemplate = Handlebars.compile(matchTemplateSource);

export type TeamId = "1" | "2";
export type AskFn = (question: string, blank?: string) => Promise<string>;

export interface RenderMapOptions {
  replayID: string;
  ask: AskFn;
  playerAliases: PlayerAliases;
  teamAliases: TeamAliases;
  cleanNames: boolean;
  lazyNaming: boolean;
  mapNumber?: number;
}

export interface RenderedMap {
  output: string;
  blue: string;
  red: string;
  blueScore: number;
  redScore: number;
  winner: string | null;
  winningTeamId: TeamId | null;
  isDraw: boolean;
  team1MiniName: string;
  team2MiniName: string;
  team1FullName: string;
  team2FullName: string;
}

/**
 * Converts total seconds to a string formatted as "XmYs"
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${minutes}m${seconds}s`;
}

function cleanedPlayerFallback(name: string): string {
  const cleaned = cleanPlayerName(name);
  return cleaned.length > 0 ? cleaned : name.trim();
}

function cleanedTeamFallback(name: string): string {
  return name.trim();
}

async function resolvePlayerName(
  matchNameRaw: string,
  ask: AskFn,
  playerAliases: PlayerAliases,
  cleanNames: boolean,
  lazyNaming: boolean,
): Promise<string> {
  const aliasFallback = cleanedPlayerFallback(matchNameRaw);
  const displayFallback = cleanNames ? aliasFallback : matchNameRaw;

  const resolvedName =
    resolvePlayerNameFromAliases(matchNameRaw, playerAliases) ??
    resolvePlayerNameFromAliases(aliasFallback, playerAliases);

  if (resolvedName !== null) {
    return addAliasForPlayer(resolvedName, matchNameRaw, playerAliases);
  }

  if (lazyNaming) {
    return addAliasForPlayer(aliasFallback, matchNameRaw, playerAliases);
  }

  const inputName = await ask(
    `Player name for alias ${matchNameRaw}? (${displayFallback}) `,
    displayFallback,
  );
  const canonicalName = inputName.trim() === "" ? displayFallback : inputName.trim();
  return addAliasForPlayer(canonicalName, matchNameRaw, playerAliases);
}

async function resolveTeamName(
  teamMiniNameRaw: string,
  teamFullNameRaw: string,
  ask: AskFn,
  teamAliases: TeamAliases,
  lazyNaming: boolean,
): Promise<string> {
  const resolvedTeamName =
    resolveTeamNameFromAliases(teamMiniNameRaw, teamAliases) ??
    resolveTeamNameFromAliases(teamFullNameRaw, teamAliases);

  if (resolvedTeamName !== null) {
    const canonicalTeamName = addAliasForTeam(resolvedTeamName, teamMiniNameRaw, teamAliases);
    addAliasForTeam(canonicalTeamName, teamFullNameRaw, teamAliases);
    return canonicalTeamName;
  }

  const aliasFallback = cleanedTeamFallback(teamFullNameRaw || teamMiniNameRaw);

  if (lazyNaming) {
    const canonicalTeamName = addAliasForTeam(aliasFallback, teamMiniNameRaw, teamAliases);
    addAliasForTeam(canonicalTeamName, teamFullNameRaw, teamAliases);
    return canonicalTeamName;
  }

  const inputName = await ask(
    `Team name for alias ${teamMiniNameRaw}? (${aliasFallback}) `,
    aliasFallback,
  );
  const canonicalTeamName = inputName.trim() === "" ? aliasFallback : inputName.trim();
  const canonicalWithMini = addAliasForTeam(canonicalTeamName, teamMiniNameRaw, teamAliases);
  addAliasForTeam(canonicalWithMini, teamFullNameRaw, teamAliases);
  return canonicalWithMini;
}

export async function getMatchData(replayID: string): Promise<unknown> {
  const params = new URLSearchParams();
  params.append("replay_id", replayID);
  params.append("zone_id", "12001");

  const data = (
    await fetch(`${ENDPOINT}?${params.toString()}`, {
      method: "GET",
      redirect: "follow",
    })
      .then((response) => response.json())
      .catch((err) => {
        throw err;
      })
  )["data"];

  if (data["matches"] == null) {
    throw new Error(`Match with replay ID ${replayID} does not exist`);
  }

  return data;
}

export async function renderMapFromReplay(options: RenderMapOptions): Promise<RenderedMap> {
  const {
    replayID,
    ask,
    playerAliases,
    teamAliases,
    cleanNames,
    lazyNaming,
    mapNumber,
  } = options;

  const matchData = (await getMatchData(replayID) as any)["matches"][0];
  const matchDuration = formatTime(matchData["match_play_duration"]);

  /* Side */
  const teamInfo = JSON.parse(matchData["dynamic_fields"]["league_round_info"]);
  const side = teamInfo["real_defense"] == 1;

  const team1MiniNameRaw = teamInfo["1"]["club_team_mini_name"];
  const team2MiniNameRaw = teamInfo["2"]["club_team_mini_name"];
  const team1FullNameRaw = teamInfo["1"]["club_team_name"] ?? team1MiniNameRaw;
  const team2FullNameRaw = teamInfo["2"]["club_team_name"] ?? team2MiniNameRaw;

  const team1FullName = await resolveTeamName(
    team1MiniNameRaw,
    team1FullNameRaw,
    ask,
    teamAliases,
    lazyNaming,
  );
  const team2FullName = await resolveTeamName(
    team2MiniNameRaw,
    team2FullNameRaw,
    ask,
    teamAliases,
    lazyNaming,
  );
  const team1MiniName = team1MiniNameRaw;
  const team2MiniName = team2MiniNameRaw;

  const blue = side
    ? team1MiniName
    : team2MiniName;
  const red = side
    ? team2MiniName
    : team1MiniName;
  const fullBlue = side
    ? team1FullName
    : team2FullName;
  const fullRed = side
    ? team2FullName
    : team1FullName;

  /* Map */
  const map: Map = idToMap(matchData["match_map_id"]);
  const derivedMapNumber = teamInfo["2"]["score"] + teamInfo["1"]["score"] + 1;
  const resolvedMapNumber = mapNumber ?? derivedMapNumber;

  /* Pick/Ban */
  const bpInfo = matchData["dynamic_fields"]["ban_pick_info"];
  const bp: string[] = [];

  for (const banpick of bpInfo) {
    bp.push(PlayedHero.getHeroDataFromID(banpick["hero_id"])[0]);
  }

  /* Players */
  const players = matchData["match_players"];
  const blueSide: Player[] = [];
  const redSide: Player[] = [];

  const mvpID = matchData["mvp_uid"];
  const svpID = matchData["svp_uid"];
  let mvp = "";
  let svp = "";

  for (const p of players) {
    const pheroes: PlayedHero[] = [];
    for (const h of p["player_heroes"]) {
      pheroes.push(new PlayedHero(h["hero_id"], h["play_time"]));
    }

    pheroes.sort(PlayedHero.compare);

    const matchNameRaw = p["nick_name"];
    const playerUid = p["player_uid"];
    const name = await resolvePlayerName(
      matchNameRaw,
      ask,
      playerAliases,
      cleanNames,
      lazyNaming,
    );

    const player: Player = {
      uid: playerUid,
      name,
      heroes: pheroes,
      heroSum: PlayedHero.calcHeroSum(pheroes, p["play_time"]),
      k: p["k"],
      d: p["d"],
      a: p["a"],
      last_kill: p["last_kill"],
    };

    if (player.uid == mvpID) {
      mvp = player.name;
    }
    if (player.uid == svpID) {
      svp = player.name;
    }

    if (p["camp"] == 0) {
      redSide.push(player);
    } else {
      blueSide.push(player);
    }
  }

  redSide.sort(comparePlayersForScoreboard);
  blueSide.sort(comparePlayersForScoreboard);

  const blueScore = matchData["dynamic_fields"]["score_info"][1];
  const redScore = matchData["dynamic_fields"]["score_info"][0];

  const output = matchTemplate({
    bside: blueSide,
    rside: redSide,
    bp,
    replayID,
    mvp,
    svp,
    duration: matchDuration,
    bluescore: blueScore,
    redscore: redScore,
    blue,
    red,
    fullBlue,
    fullRed,
    mapNumber: resolvedMapNumber,
    mode: map.gameMode,
    map: map.name,
  });

  const isDraw = blueScore === redScore;
  let winningTeamId: TeamId | null = null;
  if (!isDraw) {
    const blueTeamId: TeamId = side ? "1" : "2";
    const redTeamId: TeamId = side ? "2" : "1";
    winningTeamId = blueScore > redScore ? blueTeamId : redTeamId;
  }

  return {
    output,
    blue,
    red,
    blueScore,
    redScore,
    winner: isDraw ? null : blueScore > redScore ? blue : red,
    winningTeamId,
    isDraw,
    team1MiniName,
    team2MiniName,
    team1FullName,
    team2FullName,
  };
}
