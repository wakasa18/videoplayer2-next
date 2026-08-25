import { access, readFile } from "node:fs/promises";

const required = [
  "database/phase11_quality_assurance.sql",
  "database/phase12_acceptance_handoff.sql",
  "app/dashboard/quality/page.tsx",
  "app/dashboard/handoff/page.tsx",
  "components/handoff/handoff-client.tsx",
  "app/api/handoff/items/route.ts",
  "app/api/handoff/signoff/route.ts",
  "lib/handoff/server.ts",
  "lib/handoff/data.ts",
  "lib/handoff/types.ts",
  "docs/PHASE12_USER_GUIDE.md",
  "docs/PHASE12_ADMIN_GUIDE.md",
  "docs/PHASE12_DEPLOYMENT_ENVIRONMENT.md",
  "docs/PHASE12_BACKUP_RESTORE.md",
  "docs/PHASE12_TROUBLESHOOTING.md",
  "docs/PHASE12_UAT_CHECKLIST.md",
  "docs/PHASE12_OPERATIONS_HANDOFF.md",
  "scripts/create-clean-release.mjs",
];
for (const file of required) await access(file);

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (packageJson.scripts?.["release:check"] !== "node scripts/phase12-release-check.mjs") {
  throw new Error("package.json is not using the Phase 12 release check.");
}
for (const [name, version] of Object.entries(packageJson.dependencies ?? {})) {
  if (version === "latest") throw new Error(`Dependency ${name} must be pinned.`);
}

const sql = (await readFile("database/phase12_acceptance_handoff.sql", "utf8")).toLowerCase();
for (const expected of ["handoff_acceptance_items", "handoff_acceptance_runs", "enable row level security"]) {
  if (!sql.includes(expected)) throw new Error(`Phase 12 SQL is missing ${expected}.`);
}

const sidebar = await readFile("components/sidebar.tsx", "utf8");
if (!sidebar.includes("/dashboard/handoff")) throw new Error("Final Handoff is missing from navigation.");
const gitignore = await readFile(".gitignore", "utf8");
for (const ignored of [".env*", ".next", "node_modules", ".vercel"]) {
  if (!gitignore.includes(ignored)) throw new Error(`.gitignore must exclude ${ignored}.`);
}
console.log("Phase 12 release validation passed.");
