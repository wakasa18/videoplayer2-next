import { access, readFile } from "node:fs/promises";

const required = [
  "database/phase11_quality_assurance.sql",
  "app/dashboard/quality/page.tsx",
  "components/quality/quality-assurance-client.tsx",
  "components/quality/performance-monitor.tsx",
  "app/api/quality/run/route.ts",
  "app/api/quality/vitals/route.ts",
  "lib/quality/server.ts",
  "lib/quality/data.ts",
  "lib/quality/types.ts",
  "docs/PHASE11_QA_CHECKLIST.md",
  "docs/PHASE11_PERFORMANCE_SECURITY.md",
  "docs/PHASE11_FINAL_RELEASE.md",
  "scripts/phase11-smoke-test.mjs",
  "scripts/create-clean-release.mjs",
];
for (const file of required) await access(file);

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (packageJson.scripts?.["release:check"] !== "node scripts/phase11-release-check.mjs") {
  throw new Error("package.json is not using the Phase 11 release check.");
}
if (packageJson.scripts?.["smoke:production"] !== "node scripts/phase11-smoke-test.mjs") {
  throw new Error("package.json is not using the Phase 11 production smoke test.");
}
for (const [name, version] of Object.entries(packageJson.dependencies ?? {})) {
  if (version === "latest") throw new Error(`Dependency ${name} must be pinned instead of using latest.`);
}

const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
const crons = Array.isArray(vercel.crons) ? vercel.crons : [];
if (crons.length !== 1 || crons[0]?.path !== "/api/maintenance/daily" || crons[0]?.schedule !== "0 0 * * *") {
  throw new Error("Phase 11 requires one daily Hobby-compatible maintenance cron.");
}

const sql = await readFile("database/phase11_quality_assurance.sql", "utf8");
for (const expected of ["quality_runs", "quality_web_vitals", "enable row level security"]) {
  if (!sql.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`Phase 11 SQL is missing ${expected}.`);
  }
}

const layout = await readFile("app/layout.tsx", "utf8");
if (!layout.includes('href="#main-content"') || !layout.includes("skip-link")) {
  throw new Error("The root layout must include the keyboard skip link.");
}
const shell = await readFile("components/app-shell.tsx", "utf8");
if (!shell.includes("PerformanceMonitor") || !shell.includes('id="main-content"')) {
  throw new Error("The application shell must collect Web Vitals and expose the main landmark target.");
}
const config = await readFile("next.config.ts", "utf8");
for (const header of ["X-Content-Type-Options", "Referrer-Policy", "Content-Security-Policy"]) {
  if (!config.includes(header)) throw new Error(`Security header ${header} is missing.`);
}
const gitignore = await readFile(".gitignore", "utf8");
for (const ignored of [".env*", ".next", "node_modules", ".vercel"]) {
  if (!gitignore.includes(ignored)) throw new Error(`.gitignore must exclude ${ignored}.`);
}

console.log("Phase 11 release validation passed.");
