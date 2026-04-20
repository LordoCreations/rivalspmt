import { syncDataFromCloudOnStart } from "./utils/cloudDataSync.ts";

async function main(): Promise<void> {
  await syncDataFromCloudOnStart();
  console.log("Synced data files from gist to local data directory.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to sync data files from cloud: ${message}`);
  process.exitCode = 1;
});
