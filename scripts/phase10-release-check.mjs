import { access, readFile } from "node:fs/promises";

const required = [
  "database/phase10_post_launch_maintenance.sql",
  "app/dashboard/maintenance/page.tsx",
  "components/maintenance/maintenance-client.tsx",
  "app/api/maintenance/daily/route.ts",
  "app/api/maintenance/run/route.ts",
  "app/api/maintenance/cleanup/route.ts",
  "app/api/maintenance/verify-backup/route.ts",
  "lib/maintenance/server.ts",
  "docs/PHASE10_OPERATIONS_RUNBOOK.md",
  "docs/PHASE10_BACKUP_RESTORE_TEST.md",
  "docs/PHASE10_FINAL_HANDOFF.md",
];
for (const file of required) await access(file);
const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
const crons = Array.isArray(vercel.crons) ? vercel.crons : [];
if (crons.length !== 1 || crons[0]?.path !== "/api/maintenance/daily" || crons[0]?.schedule !== "0 0 * * *") {
  throw new Error("Phase 10 requires one daily Hobby-compatible maintenance cron.");
}
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (packageJson.scripts?.["release:check"] !== "node scripts/phase10-release-check.mjs") {
  throw new Error("package.json is not using the Phase 10 release check.");
}
console.log("Phase 10 release validation passed.");
