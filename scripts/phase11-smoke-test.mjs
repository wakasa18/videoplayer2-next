const base = String(process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  throw new Error("Usage: npm run smoke:production -- https://your-domain.com");
}

const checks = [
  { label: "Public health", path: "/api/health", accepted: [200] },
  { label: "Login page", path: "/auth/login", accepted: [200] },
  { label: "Robots metadata", path: "/robots.txt", accepted: [200] },
  { label: "Protected dashboard redirect", path: "/dashboard", accepted: [302, 303, 307, 308] },
  { label: "Quality API authentication", path: "/api/quality/run", method: "POST", accepted: [401, 403] },
  { label: "Shared preview route protection", path: "/api/public-shares/invalid/files/0/preview", accepted: [400, 401, 403, 404, 410] },
];

let failed = false;
for (const check of checks) {
  const started = Date.now();
  let response;
  try {
    response = await fetch(`${base}${check.path}`, {
      method: check.method ?? "GET",
      redirect: "manual",
      headers: { "User-Agent": "DamonArchive-Phase11-Smoke/1.0" },
    });
  } catch (error) {
    console.error(`FAIL ${check.label}: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
    continue;
  }
  const elapsed = Date.now() - started;
  const ok = check.accepted.includes(response.status);
  console.log(`${ok ? "PASS" : "FAIL"} ${check.label}: ${response.status} (${elapsed} ms)`);
  if (!ok) failed = true;

  const contentTypeOptions = response.headers.get("x-content-type-options");
  const referrerPolicy = response.headers.get("referrer-policy");
  if (!contentTypeOptions || !referrerPolicy) {
    console.log(`WARN ${check.label}: expected security headers were not both present.`);
  }
  if (elapsed > 5000) console.log(`WARN ${check.label}: response exceeded 5 seconds.`);
}

const healthSecret = String(process.env.HEALTH_CHECK_SECRET ?? "").trim();
if (healthSecret) {
  const response = await fetch(`${base}/api/health?deep=1`, {
    headers: { Authorization: `Bearer ${healthSecret}` },
  });
  const payload = await response.json().catch(() => ({}));
  const ok = response.status === 200 && payload?.status === "ok";
  console.log(`${ok ? "PASS" : "FAIL"} Deep health: ${response.status} (${payload?.status ?? "unknown"})`);
  if (!ok) failed = true;
} else {
  console.log("SKIP Deep health: HEALTH_CHECK_SECRET was not supplied to the command environment.");
}

if (failed) process.exitCode = 1;
