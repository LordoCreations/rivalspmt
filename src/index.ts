import * as readline from "node:readline";
import fs from "node:fs";

import { renderMapFromReplay } from "./utils/matchOutput.ts";
import { syncDataFromCloudOnStart } from "./utils/cloudDataSync.ts";
import { loadPlayerAliases, savePlayerAliases } from "./utils/playerAliases.ts";
import { loadTeamAliases, saveTeamAliases } from "./utils/teamAliases.ts";

const isVerbose = process.env.VERBOSE === 'true';
const cleanNames = process.env.CLEAN === 'true';

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
  const raw = (await ask("Lazy name filling? Y/N (Y)  ", "Y")).trim().toLowerCase();
  return raw !== "n";
}

const main = async () => {
  await syncDataFromCloudOnStart();

  const lazyNaming = await askForLazyNaming();
  const replayID = await ask(`Enter Match Replay ID:  `);
  const playerAliases = loadPlayerAliases();
  const teamAliases = loadTeamAliases();
  const renderedMap = await renderMapFromReplay({
    replayID,
    ask,
    playerAliases,
    teamAliases,
    cleanNames,
    lazyNaming,
  });

  savePlayerAliases(playerAliases);
  saveTeamAliases(teamAliases);

  if (isVerbose) {
    console.log(`<COPY FROM HERE>\n${renderedMap.output}`);
  } else {
    console.log(`Copy output from output/output.md`);
  }
  
  try {
    fs.mkdirSync("output", { recursive: true });
    fs.writeFileSync("output/output.md", renderedMap.output);
  } catch (err) {
    console.error("Error writing file:", err);
  }

  rl.close();
  return;
};

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exitCode = 1;
});
