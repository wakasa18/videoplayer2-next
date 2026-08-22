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
];
const requiredFiles = [
  "app/api/health/route.ts",
  "app/dashboard/system/page.tsx",
  "database/phase8_production_readiness.sql",
  "vercel.json",
];

const errors = [];
const warnings = [];
for (const key of required) {
  if (!isConfigured(process.env[key])) errors.push(`Missing ${key}`);
}
if (!isConfigured(process.env.SUPABASE_SECRET_KEY) && !isConfigured(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  warnings.push("No SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is configured.");
}
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing ${file}`);
}
if (process.env.NEXT_PUBLIC_APP_URL && !/^https:\/\//i.test(process.env.NEXT_PUBLIC_APP_URL)) {
  warnings.push("NEXT_PUBLIC_APP_URL should use https:// in production.");
}

console.log("Phase 8 release check");
console.log(`Project: ${root}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) process.exit(1);
console.log("PASS: production configuration and required Phase 8 files are present.");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function isConfigured(value) {
  const clean = String(value ?? "").trim();
  return Boolean(clean && !/(replace|your-|example|changeme|placeholder|xxxxx)/i.test(clean));
}
