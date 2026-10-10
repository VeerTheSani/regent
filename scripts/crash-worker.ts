/**
 * scripts/crash-worker.ts
 *
 * Child process for the M1 ledger crash test.
 * Appends 1000 events to the target database as fast as possible.
 */

import { Ledger } from "../src/kernel/ledger.js";

const dbPath = process.argv[2];
if (!dbPath) {
  process.exit(1);
}

const ledger = new Ledger(dbPath);

for (let i = 0; i < 1000; i++) {
  ledger.append({
    type: "crash.event",
    actor: "crash_tester",
    jobId: "crash-job",
    payload: { index: i, text: `payload-data-${i}` },
  });
  if (i === 150) {
    process.stdout.write("WRITING_ACTIVE\n");
  }
}

ledger.close();
