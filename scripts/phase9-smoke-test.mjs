const rawTarget = process.argv[2] || process.env.PHASE9_TARGET_URL || process.env.NEXT_PUBLIC_APP_URL;
if (!rawTarget) {
  console.error("Usage: npm run smoke:production -- https://your-domain.com");
  process.exit(1);
}
const target = String(rawTarget).replace(/\/$/, "");
const healthSecret = String(process.env.HEALTH_CHECK_SECRET ?? "").trim();
const tests = [
  { name: "Home page", path: "/", expected: [200, 307, 308] },
  { name: "Login page", path: "/auth/login", expected: [200] },
  { name: "Public health", path: "/api/health", expected: [200], jsonStatus: "ok" },
  { name: "Robots", path: "/robots.txt", expected: [200] },
];
if (healthSecret) tests.push({ name: "Deep health", path: "/api/health?deep=1", expected: [200], jsonStatus: "ok", authorization: true });

console.log(`Phase 9 smoke test: ${target}`);
let failures = 0;
for (const test of tests) {
  try {
    const response = await fetch(`${target}${test.path}`, {
      redirect: "manual",
      headers: test.authorization ? { Authorization: `Bearer ${healthSecret}` } : {},
    });
    let detail = `HTTP ${response.status}`;
    let passed = test.expected.includes(response.status);
    if (passed && test.jsonStatus) {
      const payload = await response.json().catch(() => null);
      passed = payload?.status === test.jsonStatus;
      detail += `, status=${payload?.status ?? "invalid-json"}, release=${payload?.release ?? "unknown"}`;
    }
    console.log(`${passed ? "PASS" : "FAIL"}: ${test.name} — ${detail}`);
    if (!passed) failures += 1;
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${test.name} — ${error instanceof Error ? error.message : error}`);
  }
}
if (failures) {
  console.error(`${failures} smoke test(s) failed.`);
  process.exit(1);
}
console.log("PASS: all automated public production smoke tests passed.");
