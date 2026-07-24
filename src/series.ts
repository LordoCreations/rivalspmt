import * as readline from "node:readline";
import fs from "node:fs";
import Handlebars from "handlebars";

import { renderMapFromReplay } from "./utils/matchOutput.ts";
import { syncDataFromCloudOnStart } from "./utils/cloudDataSync.ts";
import { loadPlayerAliases, savePlayerAliases } from "./utils/playerAliases.ts";
import { loadTeamAliases, saveTeamAliases } from "./utils/teamAliases.ts";

const isVerbose = process.env.VERBOSE === "true";
const cleanNames = process.env.CLEAN === "true";
const includeHeader = process.env.HEADER === "true";

const headerTemplateSource = fs.readFileSync(
  "templates/headertemplate.md",
  "utf-8",
);
const headerTemplate = Handlebars.compile(headerTemplateSource);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const queuedLines: string[] = [];
const queuedReplayTokens: string[] = [];
const waitingResolvers: Array<(line: string) => void> = [];

rl.on("line", (line: string) => {
  const resolver = waitingResolvers.shift();
  if (resolver !== undefined) {
    resolver(line);
    return;
  }

  queuedLines.push(line);
});

function readLine(): Promise<string> {
  const queuedLine = queuedLines.shift();
  if (queuedLine !== undefined) {
    return Promise.resolve(queuedLine);
  }

  return new Promise((resolve) => {
    waitingResolvers.push(resolve);
  });
}

function queueReplayTokensFromLine(line: string): void {
  const tokens = line.trim().split(/\s+/).filter((token) => token.length > 0);

  for (const token of tokens) {
    queuedReplayTokens.push(token);
  }
}

async function readReplayID(): Promise<string | null> {
  while (queuedReplayTokens.length === 0) {
    const line = await readLine();
    queueReplayTokensFromLine(line);
  }

  const replayID = queuedReplayTokens.shift();
  if (replayID === undefined) {
    return null;
  }

  if (replayID.toLowerCase() === "esc") {
    return null;
  }

  return replayID;
}

const ask = async (
  question: string,
  blank: string = "",
  newline: boolean = false,
): Promise<string> => {
  process.stdout.write(newline ? `${question}\n` : question);
  const answer = await readLine();
  return answer === "" ? blank : answer;
};

function printLoadedMaps(mapStart: number, mapEnd: number): void {
  if (mapEnd >= mapStart) {
    const label = mapStart === mapEnd ? "Map" : "Maps";
    const range = mapStart === mapEnd ? `${mapStart}` : `${mapStart} to ${mapEnd}`;
    console.log(`> (Loaded ${label} ${range}) <`);
  }
}

async function askForLazyNaming(): Promise<boolean> {
  const raw = (await ask("Lazy name filling? Y/N (N)  ", "N")).trim().toLowerCase();
  return raw !== "n";
}

async function askForBestOf(): Promise<number> {
  while (true) {
    const raw = await ask("Enter series length (best of #):  ");
    const bestOf = Number(raw);

    if (Number.isInteger(bestOf) && bestOf > 0) {
      return bestOf;
    }

    console.log("Please enter a positive integer (for example: 3 or 5).");
  }
}

function hasSeriesWinner(seriesWins: Record<string, number>, winsNeeded: number): boolean {
  const highestScore = Math.max(0, ...Object.values(seriesWins));
  return highestScore >= winsNeeded;
}

function formatSeriesScoreSummary(
  renderedMaps: Array<{
    blueScore: number;
    fullBlue: string;
    fullRed: string;
    mapName: string;
    redScore: number;
  }>,
): string {
  const rows = renderedMaps.map((renderedMap) => {
    const blueTeam = renderedMap.blueScore > renderedMap.redScore
      ? `***${renderedMap.fullBlue}***`
      : renderedMap.fullBlue;
    const redTeam = renderedMap.redScore > renderedMap.blueScore
      ? `***${renderedMap.fullRed}***`
      : renderedMap.fullRed;

    return `| ${renderedMap.mapName.toUpperCase()} | &nbsp; | ${blueTeam} | **${renderedMap.blueScore}**-**${renderedMap.redScore}** | ${redTeam} |`;
  });

  return [
    `| Map | &nbsp; | Blue Side | Score | Red Side |`,
    `| :--- | :---: | :--- | :---: | ---: |`,
    ...rows,
  ].join("\n");
}

const main = async () => {
  await syncDataFromCloudOnStart();

  const lazyNaming = await askForLazyNaming();
  const bestOf = await askForBestOf();
  const winsNeeded = Math.floor(bestOf / 2) + 1;

  const playerAliases = loadPlayerAliases();
  const teamAliases = loadTeamAliases();
  const seriesWins: Record<"1" | "2", number> = { "1": 0, "2": 0 };
  const mapOutputs: string[] = [];
  const renderedMaps: Array<{
    blueScore: number;
    fullBlue: string;
    fullRed: string;
    mapName: string;
    redScore: number;
  }> = [];
  let seriesTeams: { team1FullName: string; team2FullName: string } | null = null;

  let mapNumber = 1;
  let batchMapStart = mapNumber;

  console.log("Enter replay IDs separated by linebreak or space. Type 'esc' to stop.");

  while (!hasSeriesWinner(seriesWins, winsNeeded)) {
    const replayID = await readReplayID();

    if (replayID === null) {
      printLoadedMaps(batchMapStart, mapNumber - 1);
      break;
    }

    try {
      const renderedMap = await renderMapFromReplay({
        replayID,
        ask,
        playerAliases,
        teamAliases,
        cleanNames,
        lazyNaming,
        mapNumber,
      });

      if (seriesTeams === null) {
        seriesTeams = {
          team1FullName: renderedMap.team1FullName,
          team2FullName: renderedMap.team2FullName,
        };
      }

      mapOutputs.push(renderedMap.output);
      renderedMaps.push({
        blueScore: renderedMap.blueScore,
        fullBlue: renderedMap.fullBlue,
        fullRed: renderedMap.fullRed,
        mapName: renderedMap.mapName,
        redScore: renderedMap.redScore,
      });

      if (renderedMap.isDraw) {
        console.log(`Map ${mapNumber} was a draw. Enter another replay ID for Map ${mapNumber}.`);
        continue;
      }

      if (renderedMap.winningTeamId !== null) {
        seriesWins[renderedMap.winningTeamId] += 1;
      }

      mapNumber += 1;

      if (queuedReplayTokens.length === 0) {
        printLoadedMaps(batchMapStart, mapNumber - 1);
        batchMapStart = mapNumber;
      }
    } catch (err) {
      console.error(err);
      console.log(`Unable to process replay ID ${replayID}. Please try again for Map ${mapNumber}.`);
    }
  }

  savePlayerAliases(playerAliases);
  saveTeamAliases(teamAliases);

  const mapsOutput = mapOutputs.join("\n\n");
  const summaryOutput = renderedMaps.length > 0
    ? formatSeriesScoreSummary(renderedMaps)
    : "";
  let output = mapsOutput === "" ? summaryOutput : `${summaryOutput}\n\n${mapsOutput}`;

  if (includeHeader) {
    const header = headerTemplate({
      fullTeam1Name: seriesTeams?.team1FullName ?? "Team 1",
      fullTeam2Name: seriesTeams?.team2FullName ?? "Team 2",
      team1Score: seriesWins["1"],
      team2Score: seriesWins["2"],
      format: bestOf,
    });

    output = mapsOutput === ""
      ? header
      : `${header}\n\n${summaryOutput}\n\n${mapsOutput}`;
  }

  if (isVerbose) {
    console.log(`<COPY FROM HERE>\n${output}`);
  } else {
    console.log(`Copy output from output/output.md`);
  }

  try {
    fs.mkdirSync("output", { recursive: true });
    fs.writeFileSync("output/output.md", output);
  } catch (err) {
    console.error("Error writing file:", err);
  }

  rl.close();
};

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exitCode = 1;
});
