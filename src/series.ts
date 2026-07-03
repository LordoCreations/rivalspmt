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

const ask = (question: string, blank: string = ""): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      resolve(answer === "" ? blank : answer);
    });
  });
};

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
  const mapLines = renderedMaps.map(
    (renderedMap) =>
      `- **${renderedMap.mapName.toUpperCase()}**: ${renderedMap.fullBlue} **${renderedMap.blueScore}**-**${renderedMap.redScore}** ${renderedMap.fullRed}`,
  );

  return mapLines.join("\n");
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

  while (!hasSeriesWinner(seriesWins, winsNeeded)) {
    const replayID = await ask(`Enter Replay ID for Map ${mapNumber} (type esc to exit):  `);

    if (replayID.trim() === "" || replayID.trim().toLowerCase() === "esc") {
      console.log("No replay ID entered. Ending input and writing current output.");
      break;
    } else if (replayID.trim() === "") {
      console.log("Invalid replay ID. Please try again.");
      continue;
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
