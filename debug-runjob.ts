import { RegentDaemon } from "./src/daemon.js";

async function main() {
  console.log("[1] Instantiating RegentDaemon...");
  const daemon = new RegentDaemon();
  console.log("[2] Calling runJob...");
  const t0 = Date.now();
  const res = await daemon.runJob("open chrome and play the vader clip");
  console.log("[3] runJob finished:", res);
}

main().catch(console.error);
