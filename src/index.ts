import * as readline from "node:readline";
import { URLSearchParams } from "node:url";
import Handlebars from "handlebars";
import fs from "fs";

import { comparePlayersForScoreboard, PlayedHero, type Player } from "./utils/player.ts";
import { idToMap, type Map } from "./utils/maps.ts";

const isVerbose = process.env.VERBOSE === 'true';

// Read Markdown content
const matchTemplateSource = fs.readFileSync(
  "templates/maptemplate.md",
  "utf-8",
);

const ENDPOINT: String =
  "https://interact32-h.webapp.easebar.com/x20namwss202505/x20mwss202505_get_history_by_replay_id/";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question: string, blank: string = ""): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      if (answer == "") resolve(blank);
      resolve(answer);
    });
  });
};

/**
 * Converts total seconds to a string formatted as "XmYs"
 */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${minutes}m${seconds}s`;
}

/*
 * blue side = camp 0
 * red side = camp 1
 */

const getMatchData = async (replayID: string) => {
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

  if (data["matches"] == null)
    throw new Error(`Match with replay ID ${replayID} does not exist`);
  return data;
};

const main = async () => {
  const replayID = await ask(`Enter Match Replay ID:  `);
  const lazy =
    (await ask("Lazy name filling? Y/N (Y)  ")).toLowerCase() == "n" ? false : true;

  const matchData = (await getMatchData(replayID))["matches"][0];
  const matchDuration = formatTime(matchData["match_play_duration"]);

  /* Side */
  const teamInfo = JSON.parse(matchData["dynamic_fields"]["league_round_info"]);
  const side = teamInfo["real_defense"] == 1 ? true : false;

  const blue = side
    ? teamInfo["1"]["club_team_mini_name"]
    : teamInfo["2"]["club_team_mini_name"];
  const red = side
    ? teamInfo["2"]["club_team_mini_name"]
    : teamInfo["1"]["club_team_mini_name"];

  /* Map */
  const map: Map = idToMap(matchData["match_map_id"]);
  const mapNumber = teamInfo["2"]["score"] + teamInfo["1"]["score"] + 1;

  /* Pick/Ban */
  const bpInfo = matchData["dynamic_fields"]["ban_pick_info"];
  var bp = [];

  for (let banpick of bpInfo) {
    bp.push(PlayedHero.getHeroDataFromID(banpick["hero_id"])[0]);
  }

  /* Players */
  const players = matchData["match_players"];
  var blueSide: Player[] = [];
  var redSide: Player[] = [];

  var mvpID = matchData["mvp_uid"];
  var svpID = matchData["svp_uid"];
  var mvp: string = "",
    svp: string = "";

  for (let p of players) {
    let pheroes: PlayedHero[] = [];
    for (let h of p["player_heroes"]) {
      pheroes.push(new PlayedHero(h["hero_id"], h["play_time"]));
    }

    pheroes.sort(PlayedHero.compare);

    let player: Player = {
      uid: p["player_uid"],
      name: lazy
        ? p["nick_name"]
        : await ask(
            `What is ${p["nick_name"]}'s IGN? (${p["nick_name"]}) `,
            p["nick_name"],
          ),
      heroes: pheroes,
      heroSum: PlayedHero.calcHeroSum(pheroes, p["play_time"]),
      k: p["k"],
      d: p["d"],
      a: p["a"],
      last_kill: p["last_kill"],
    };

    if (player.uid == mvpID) mvp = player.name;
    if (player.uid == svpID) svp = player.name;

    if (p["camp"] == 0) redSide.push(player);
    else blueSide.push(player);
  }

  redSide.sort(comparePlayersForScoreboard)
  blueSide.sort(comparePlayersForScoreboard)


  /* fill template */
  const matchTemplate = Handlebars.compile(matchTemplateSource);
  const data = {
    bside: blueSide,
    rside: redSide,
    bp: bp,
    replayID: replayID,
    mvp: mvp,
    svp: svp,
    duration: matchDuration,
    bluescore: matchData["dynamic_fields"]["score_info"][1],
    redscore: matchData["dynamic_fields"]["score_info"][0],
    blue: blue,
    red: red,
    mapNumber: mapNumber,
    mode: map.gameMode,
    map: map.name,
  };

  const output = matchTemplate(data)
  if (isVerbose) console.log(`<COPY FROM HERE>\n`+output)
  
  try {
    fs.mkdirSync("output", { recursive: true });
    fs.writeFileSync("output/output.md", matchTemplate(data));
  } catch (err) {
    console.error("Error writing file:", err);
  }

  rl.close();
  return;
};

main();
