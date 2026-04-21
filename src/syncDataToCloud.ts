import { pushLocalDataToCloud } from "./utils/cloudDataSync.ts";

async function main(): Promise<void> {
  const result = await pushLocalDataToCloud();
  console.log(`Updated gist ${result.gistId}`);
  console.log(`Files: ${result.updatedFiles.join(", ")}`);
  console.log(`URL: ${result.gistUrl}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to push data files to cloud: ${message}`);
  process.exitCode = 1;
});
