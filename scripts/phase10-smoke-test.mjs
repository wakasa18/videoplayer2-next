const base = String(process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) throw new Error("Usage: npm run smoke:production -- https://your-domain.com");
const checks = [
  ["Public health", "/api/health", [200]],
  ["Login page", "/auth/login", [200]],
  ["Shared preview route protection", "/api/public-shares/invalid/files/0/preview", [400, 401, 403, 404, 410]],
];
let failed = false;
for (const [label, path, accepted] of checks) {
  const started = Date.now();
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  const elapsed = Date.now() - started;
  const ok = accepted.includes(response.status);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${response.status} (${elapsed} ms)`);
  if (!ok) failed = true;
}
if (failed) process.exitCode = 1;
