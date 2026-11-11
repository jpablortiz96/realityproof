// End-to-end check of the deployed demo: public edition for anyone (fresh, cookie-less sessions, desktop
// and mobile) and the full edition for judges (cookie from the invite link). Read-only: no request it
// sends can move money or change state on a PUBLIC_DEMO_MODE server.
// Usage: node scripts/showcase/public-demo-e2e.cjs <base-url> <judge-token-file> <report.json>
const { chromium, devices } = require("playwright");
const fs = require("fs");
const [BASE, TOKEN_FILE, OUT] = process.argv.slice(2);
const steps = [];
const step = (name, ok, detail = "") => {
  steps.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${String(detail).slice(0, 100)}]` : ""}`);
};
const NAVS = {
  REQUESTER: ["DASHBOARD", "NEW_VERIFICATION", "MY_VERIFICATIONS", "RESULTS", "ACTIVITY_PAYMENTS", "INTELLIGENCE_STUDIO"],
  VERIFIER: ["TASKS", "ACTIVE_MISSION", "HISTORY", "REMUNERATION"],
  OPERATOR: ["DECISION_CENTER", "REVIEW_QUEUE", "EVIDENCES", "AUDIT_HISTORY", "INTELLIGENCE_STUDIO"],
  JUDGE: ["TOUR", "SANDBOX_PROOF", "INTELLIGENCE_STUDIO"],
};

function track(page) {
  const t = { http: [], errors: [], agScripts: [], money: [], turns: [] };
  page.on("pageerror", (e) => t.errors.push(String(e).slice(0, 120)));
  page.on("response", async (r) => {
    const u = new URL(r.url());
    if (r.status() >= 400) t.http.push(`${r.status()} ${u.pathname}`);
    if (/funding|capture|payout|\/review$|\/analyze|\/evidence/i.test(u.pathname) && r.request().method() !== "GET") t.money.push(`${r.request().method()} ${u.pathname} ${r.status()}`);
    if (u.pathname.endsWith("studio-agent-turn")) { const j = await r.json().catch(() => ({})); t.turns.push({ http: r.status(), engine: j.meta?.engine, tools: (j.output ?? []).filter((o) => o.type === "function_call").map((o) => o.name) }); }
  });
  return t;
}
async function bodyHasAgStudio(page) {
  return page.evaluate(async () => {
    const srcs = [...document.scripts].map((s) => s.src).filter(Boolean);
    for (const s of srcs) { const txt = await (await fetch(s)).text(); if (/ag-grid|ag-charts|ag-studio/.test(txt)) return true; }
    return false;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });

  // 1. HTTPS and redirects.
  const ctx0 = await browser.newContext();
  const r0 = await ctx0.request.get(BASE.replace("https://", "http://") + "/", { maxRedirects: 0 }).catch(() => null);
  step("HTTP redirects to HTTPS", r0 && [301, 308].includes(r0.status()) && (r0.headers().location || "").startsWith("https://"), r0 && `${r0.status()} ${r0.headers().location}`);
  const ready = await ctx0.request.get(BASE + "/ready");
  step("public /ready answers in public demo mode", ready.status() === 200 && (await ready.text()).includes('"public_demo_mode":true'));
  const home = await ctx0.request.get(BASE + "/");
  step("public root opens directly (no 403, no invite)", home.status() === 200 && home.headers()["x-realityproof-edition"] === "public", `${home.status()} edition=${home.headers()["x-realityproof-edition"]}`);
  step("HSTS and CSP headers", (home.headers()["strict-transport-security"] || "").includes("max-age") && (home.headers()["content-security-policy"] || "").includes("frame-ancestors 'none'"));
  for (const [path, label] of [["/api/v1/verification-requests/task_live_sbx_1793222660264/funding/create-order", "create a PayPal order"], ["/api/v1/verification-requests/task_live_sbx_1793222660264/funding/capture-order", "capture a PayPal order"]]) {
    const r = await ctx0.request.post(BASE + path, { data: {}, headers: { "content-type": "application/json" } });
    step(`public visitor cannot ${label}`, r.status() === 403 || r.status() === 401, r.status());
  }
  await ctx0.close();

  // 2. Two independent fresh desktop sessions + one mobile session, public edition.
  for (const [label, opts] of [["session A (desktop)", { viewport: { width: 1600, height: 900 } }], ["session B (desktop)", { viewport: { width: 1366, height: 768 } }], ["mobile (iPhone 13)", devices["iPhone 13"]]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const t = track(page);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    step(`${label}: app opens with the public demo banner`, (await page.title()).includes("RealityProof") && (await page.getByText(/Read-only public demo/i).count()) > 0);
    step(`${label}: no AG Studio code in the scripts it loaded`, !(await bodyHasAgStudio(page)));
    if (label.startsWith("mobile")) {
      step(`${label}: no horizontal page scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await ctx.close();
      continue;
    }
    for (const [role, items] of Object.entries(NAVS)) {
      await page.locator("#role-switcher-desktop").selectOption(role);
      await page.waitForTimeout(600);
      let ok = 0;
      for (const id of items) { await page.getByTestId(`nav-item-${id}`).click(); await page.waitForTimeout(700); if (!(await page.getByText(/Something went wrong/i).count())) ok++; }
      step(`${label}: ${role} views render`, ok === items.length, `${ok}/${items.length}`);
    }
    if (label.startsWith("session A")) {
      await page.locator("#role-switcher-desktop").selectOption("JUDGE");
      await page.getByTestId("nav-item-INTELLIGENCE_STUDIO").click();
      await page.waitForTimeout(800);
      step("public Intelligence Studio shows the judges-only notice", (await page.getByTestId("studio-public-edition-notice").count()) === 1);
      await page.getByTestId("nav-item-SANDBOX_PROOF").click();
      await page.waitForTimeout(1500);
      const sb = await page.textContent("body");
      step("historical PayPal Sandbox record is shown as Sandbox / test money", /Sandbox/i.test(sb) && /REAL_SANDBOX_CAPTURE|real capture/i.test(sb));
      // "Verified Sandbox Proof" opens the record in the requester's results view, so switch back.
      await page.locator("#role-switcher-desktop").selectOption("JUDGE");
      await page.waitForTimeout(600);
      await page.getByTestId("nav-item-TOUR").click();
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: /Inspect Live Proof Passport/i }).first().click();
      await page.waitForTimeout(2000);
      step("Proof Passport opens and states its limits", /limitations/i.test(await page.textContent("body")));
      const verify = page.getByRole("button", { name: /Verify integrity/i }).first();
      await verify.scrollIntoViewIfNeeded();
      await verify.click();
      const ok = await page.getByText(/Integrity verified live \(HTTP 200\)/i).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
      step("integrity check of the passport succeeds (HTTP 200, SHA-256 match)", ok);
      const bodyText = await page.textContent("body");
      step("no secrets on screen", !/AIza[\w-]{20,}|client_secret|A21AA|BEGIN [A-Z ]*PRIVATE KEY/.test(bodyText));
    }
    step(`${label}: no page errors`, t.errors.length === 0, t.errors.join(" | "));
    step(`${label}: no state-changing requests sent`, t.money.length === 0, t.money.join(", "));
    step(`${label}: no HTTP errors`, t.http.length === 0, t.http.join(", "));
    await ctx.close();
  }

  // 3. Judges: full edition with AG Studio and the live Gemini agent.
  const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  const jctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const jp = await jctx.newPage();
  const jt = track(jp);
  await jp.goto(`${BASE}/__preview/${token}`, { waitUntil: "networkidle" });
  const edition = (await jctx.request.get(BASE + "/")).headers()["x-realityproof-edition"];
  step("judges' link opens the full edition", jp.url() === BASE + "/" && edition === "full", edition);
  const cookie = (await jctx.cookies()).find((c) => c.name === "rp_preview");
  step("judges' cookie is Secure, HttpOnly and lasts 30 days", cookie && cookie.secure && cookie.httpOnly && cookie.expires * 1000 - Date.now() > 29 * 86400000);
  await jp.locator("#role-switcher-desktop").selectOption("JUDGE");
  await jp.getByTestId("nav-item-INTELLIGENCE_STUDIO").click();
  await jp.waitForSelector('[data-testid="ag-studio-native-container"]', { timeout: 30000 });
  await jp.waitForTimeout(2500);
  step("judges see AG Studio with its custom widgets", (await jp.locator('[data-testid^="custom-widget-"]').count()) >= 4);
  const n0 = jt.turns.length;
  await jp.getByTestId("studio-demo-query-D").click();
  for (let i = 0; i < 60 && jt.turns.length === n0; i++) await jp.waitForTimeout(1000);
  await jp.waitForTimeout(4000);
  step("judges' agent query D runs and calls add_evidence_chart", jt.turns.slice(n0).some((x) => x.http === 200 && x.tools.includes("add_evidence_chart")), JSON.stringify(jt.turns.slice(n0)));
  step("judges' session: no state-changing requests", jt.money.length === 0, jt.money.join(", "));
  await jctx.close();

  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify({ executed_at: new Date().toISOString(), base: BASE, passed: steps.filter((s) => s.ok).length, total: steps.length, steps }, null, 2));
  console.log(`${steps.filter((s) => s.ok).length}/${steps.length} passed`);
})();
