import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
loadEnv(path.join(root, ".env.local"));
loadEnv(path.join(root, ".env.production"));

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
  "SHARE_TOKEN_ENCRYPTION_KEY",
  "SHARE_ANALYTICS_SALT",
  "HEALTH_CHECK_SECRET",
];
const requiredFiles = [
  "app/api/health/route.ts",
  "app/api/deployment/releases/route.ts",
  "app/dashboard/deployment/page.tsx",
  "database/phase8_production_readiness.sql",
  "database/phase9_production_cutover.sql",
  "docs/PHASE9_VERCEL_DEPLOYMENT.md",
  "docs/PHASE9_CUTOVER_RUNBOOK.md",
  "vercel.json",
];

const errors = [];
const warnings = [];
for (const key of required) {
  if (!isConfigured(process.env[key])) errors.push(`Missing ${key}`);
}
if (!isConfigured(process.env.SUPABASE_SECRET_KEY) && !isConfigured(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  errors.push("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
}
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing ${file}`);
}

const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
if (appUrl && !/^https:\/\//i.test(appUrl)) errors.push("NEXT_PUBLIC_APP_URL must use https:// for production.");
if (appUrl && /localhost|127\.0\.0\.1/i.test(appUrl)) errors.push("NEXT_PUBLIC_APP_URL still points to localhost.");
for (const key of ["CRON_SECRET", "SHARE_TOKEN_ENCRYPTION_KEY", "SHARE_ANALYTICS_SALT", "HEALTH_CHECK_SECRET"]) {
  const value = String(process.env[key] ?? "").trim();
  if (value && value.length < 24) warnings.push(`${key} should contain at least 24 random characters.`);
}
const secretValues = ["CRON_SECRET", "SHARE_TOKEN_ENCRYPTION_KEY", "SHARE_ANALYTICS_SALT", "HEALTH_CHECK_SECRET"]
  .map((key) => [key, String(process.env[key] ?? "").trim()])
  .filter(([, value]) => value);
for (let i = 0; i < secretValues.length; i += 1) {
  for (let j = i + 1; j < secretValues.length; j += 1) {
    if (secretValues[i][1] === secretValues[j][1]) errors.push(`${secretValues[i][0]} and ${secretValues[j][0]} must use different values.`);
  }
}

validateVercelConfig();

console.log("Phase 9 production cutover check");
console.log(`Project: ${root}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exit(1);
console.log("PASS: Phase 9 deployment configuration and required files are present.");

function validateVercelConfig() {
  const file = path.join(root, "vercel.json");
  if (!fs.existsSync(file)) return;
  try {
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    const cron = Array.isArray(config.crons) ? config.crons.find((item) => item.path === "/api/assignments/automation") : null;
    if (!cron) errors.push("vercel.json is missing the assignment automation cron.");
  } catch (error) {
    errors.push(`vercel.json is invalid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function isConfigured(value) {
  const clean = String(value ?? "").trim();
  return Boolean(clean && !/(replace|your-|example|changeme|placeholder|xxxxx)/i.test(clean));
}
