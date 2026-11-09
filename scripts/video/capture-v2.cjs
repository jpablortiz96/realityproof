// Captures real RealityProof footage for the v2 video: one 1920x1080 recording per scene plus PNG stills.
// Read-only scenes come from the deployed demo; scenes that write (synthetic funding, photos, Gemini,
// human review) come from a local `full` profile with PayPal credentials empty. Makes no PayPal call.
// Usage: node scripts/video/capture-v2.cjs <aws-base> <preview-token-file> <local-base> <out-dir> [scene ...]
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const [AWS, TOKEN_FILE, LOCAL, OUT, ...ONLY] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REC = path.join(OUT, "screen-recordings");
const CAP = path.join(OUT, "captures");
fs.mkdirSync(REC, { recursive: true });
fs.mkdirSync(CAP, { recursive: true });
const provenance = [];
const agentTurns = [];
const moneyRequests = [];

// A visible cursor drawn over the page (the app is not changed; this only renders a dot that follows the mouse).
const CURSOR = `
  window.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__rp_cursor';
    Object.assign(c.style, { position: 'fixed', left: '-40px', top: '-40px', width: '22px', height: '22px',
      borderRadius: '50%', background: 'rgba(190,242,100,0.35)', border: '2px solid #bef264',
      boxShadow: '0 0 12px rgba(190,242,100,0.6)', zIndex: 2147483647, pointerEvents: 'none',
      transform: 'translate(-50%,-50%)', transition: 'width .12s, height .12s' });
    document.body.appendChild(c);
    document.addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    document.addEventListener('mousedown', () => { c.style.width = '14px'; c.style.height = '14px'; }, true);
    document.addEventListener('mouseup', () => { c.style.width = '22px'; c.style.height = '22px'; }, true);
  });`;

async function makeContext(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: path.join(OUT, "work", "raw"), size: { width: 1920, height: 1080 } },
  });
  if (base === AWS) {
    const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
    await context.addCookies([{ name: "rp_preview", value: token, domain: new URL(AWS).hostname, path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
  }
  await context.addInitScript(CURSOR);
  return context;
}

function watch(page, scene) {
  page.on("response", async (r) => {
    const u = new URL(r.url());
    if (u.pathname.endsWith("studio-agent-turn")) {
      const j = await r.json().catch(() => ({}));
      agentTurns.push({ scene, http: r.status(), engine: j.meta?.engine, model: j.meta?.model_id, degraded: j.meta?.degraded_reason ?? null,
        tools: (j.output ?? []).filter((o) => o.type === "function_call").map((o) => o.name), at: new Date().toISOString() });
    }
    if (/funding|capture|payout|\/review$|\/analyze/i.test(u.pathname) && r.request().method() !== "GET") {
      const body = r.request().postData() ?? "";
      moneyRequests.push({ scene, request: `${r.request().method()} ${u.pathname}`, status: r.status(), payout_requested: body.includes('"attempt_sandbox_payout":true') });
    }
  });
}

const SCENES = [
  { id: "A_requester_dashboard", base: "AWS", evidence: "Read-only public demo: seeded synthetic requests and one historical PayPal Sandbox record",
    run: async (p, h) => { await h.role("REQUESTER"); await h.nav("DASHBOARD"); await sleep(2500); await h.still("dashboard"); await h.scroll(380); await sleep(2500); await h.still("dashboard-recent"); await h.scroll(0); } },
  { id: "B_new_verification_voi", base: "LOCAL", evidence: "Local full profile: new synthetic request form and Value of Information calculator (user inputs, no payment)",
    run: async (p, h) => { await h.role("REQUESTER"); await h.nav("NEW_VERIFICATION"); await sleep(3000); await h.still("contract"); await h.btn(/^Continue/).click().catch(() => {}); await sleep(3500); await h.still("voi"); await h.btn(/^Continue/).click().catch(() => {}); await sleep(3000); await h.still("voi-review"); } },
  { id: "C_paypal_provenance", base: "AWS", evidence: "Historical PayPal Sandbox order and capture recorded earlier (test money, no new payment)",
    run: async (p, h) => { await h.role("JUDGE"); await h.nav("SANDBOX_PROOF"); await sleep(2500); await h.still("sandbox-proof"); await h.scroll(450); await sleep(3000); await h.still("sandbox-proof-detail"); await h.scroll(900); await sleep(2500); } },
  { id: "D0_synthetic_funding", base: "LOCAL", evidence: "Local full profile: DEMO funding of the synthetic case, labelled no real money; no PayPal request",
    run: async (p, h) => { await h.role("REQUESTER"); await h.nav("MY_VERIFICATIONS"); await h.btn(/FictoParts KX-20 Fuel Injector/i).first().click(); await sleep(2000); await h.btn(/Simulate DEMO funding/i).click(); await sleep(2500); await h.still("demo-funding"); } },
  { id: "D_verifier_guided_capture", base: "LOCAL", evidence: "Local full profile: verifier uploads the three bundled synthetic fixture photos (FictoParts, fictional)",
    run: async (p, h) => { await h.role("VERIFIER"); await h.nav("TASKS"); await sleep(1500); await h.still("tasks"); await h.btn(/Start verification/i).first().click(); await sleep(2000); await h.btn(/Capture next photo/i).click(); await sleep(1500); await h.still("checklist");
      for (let i = 0; i < 3; i++) { await h.btn(/Load matching SKU fixture/i).click(); await sleep(1600); if (i === 0) await h.still("photo-1"); await h.btn(/Send .* to server/i).click(); await sleep(1800); }
      await h.btn(/4\. Status/i).click().catch(() => {}); await sleep(2500); await h.still("status"); } },
  { id: "E_gemini_analysis", base: "LOCAL", evidence: "Local full profile: live Gemini multimodal analysis of the synthetic fixture photos",
    run: async (p, h) => { await h.role("OPERATOR"); await h.nav("DECISION_CENTER"); await h.btn(/FictoParts KX-20 Fuel Injector/i).first().click().catch(() => {}); await sleep(1500); await h.still("desk-before");
      for (let a = 1; ; a++) { await h.btn(/Run Gemini Inspection|Re-run Gemini/i).first().click();
        const ok = await p.getByText(/Visual\s+Observations/i).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
        if (ok) break; if (a === 3) throw new Error("Gemini analysis did not return"); await sleep(5000); }
      await sleep(2000); await h.still("gemini-result");
      await p.getByText(/Inspected Pixels/i).first().evaluate((e) => e.scrollIntoView({ block: "start", behavior: "smooth" })).catch(() => {}); await sleep(3000); await h.still("gemini-observations");
      await p.getByText(/Uncertainties/i).first().evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" })).catch(() => {}); await sleep(3000); await h.still("gemini-uncertainties"); } },
  { id: "F_operator_desk", base: "AWS", evidence: "Read-only public demo: Operator decision desk; decisions are disabled on the server",
    run: async (p, h) => { await h.role("OPERATOR"); await h.nav("DECISION_CENTER"); await sleep(2500); await h.still("desk"); await h.nav("REVIEW_QUEUE"); await sleep(2500); await h.still("queue"); await h.nav("AUDIT_HISTORY"); await sleep(2500); await h.still("audit"); } },
  { id: "G_human_review", base: "LOCAL", evidence: "Local full profile: human operator records an approval on the synthetic case with a written justification; no payout",
    run: async (p, h) => { await h.role("OPERATOR"); await h.nav("DECISION_CENTER"); await h.btn(/FictoParts KX-20 Fuel Injector/i).first().click().catch(() => {}); await sleep(1500);
      await h.btn(/Insert complete visual verification note/i).scrollIntoViewIfNeeded(); await sleep(1200); await h.still("sku-compare");
      await h.btn(/Insert complete visual verification note/i).click(); await sleep(1500); await h.still("justification");
      await h.btn(/Approve & issue Passport/i).click(); await sleep(1500); await h.still("confirm");
      await h.btn(/Confirm & Record Decision/i).click(); await sleep(2000); await h.still("recorded"); } },
  { id: "H_passport_synthetic", base: "LOCAL", evidence: "Local full profile: Proof Passport just issued for the synthetic case, with its hashes and limitations",
    run: async (p, h) => { await h.role("OPERATOR"); await h.nav("DECISION_CENTER"); await h.btn(/FictoParts KX-20 Fuel Injector/i).first().click().catch(() => {}); await sleep(1200);
      await h.btn(/Open Proof Passport/i).first().click(); await sleep(2500); await h.scroll(0); await h.still("passport-top"); await h.scroll(650); await sleep(2500); await h.still("passport-limits"); await h.scroll(1300); await sleep(2500); await h.still("passport-hashes"); } },
  { id: "H2_passport_historical", base: "AWS", evidence: "Read-only public demo: Proof Passport of the historical PayPal Sandbox record",
    run: async (p, h) => { await h.role("JUDGE"); await h.nav("TOUR"); await sleep(2000); await h.btn(/Inspect Live Proof Passport/i).first().click(); await sleep(2500); await h.still("hist-passport"); await h.scroll(700); await sleep(2500); await h.still("hist-passport-limits"); } },
  { id: "C2_traceability", base: "AWS", evidence: "Read-only public demo: trust & traceability drawer of the historical PayPal Sandbox record (order/capture IDs, SHA-256 hashes)",
    run: async (p, h) => { await h.role("JUDGE"); await h.nav("SANDBOX_PROOF"); await sleep(2000);
      const d = p.getByText(/View trust & traceability details/i).first(); await d.scrollIntoViewIfNeeded(); await sleep(1200); await d.click(); await sleep(2500); await h.still("trace-open");
      await p.mouse.wheel(0, 500); await sleep(2500); await h.still("trace-ids"); await p.mouse.wheel(0, 500); await sleep(2500); await h.still("trace-hashes"); } },
  { id: "H3_integrity_check", base: "LOCAL", evidence: "Local full profile: live integrity check of the synthetic case's Proof Passport (signed read URL fetched, SHA-256 compared)",
    run: async (p, h) => { await h.role("OPERATOR"); await h.nav("DECISION_CENTER"); await h.btn(/FictoParts KX-20 Fuel Injector/i).first().click().catch(() => {}); await sleep(1200);
      await h.btn(/Open Proof Passport/i).first().click(); await sleep(2500);
      const v = h.btn(/Verify integrity/i).first(); await v.scrollIntoViewIfNeeded(); await sleep(1200); await v.click(); await sleep(2500); await h.still("integrity-verified");
      const d = p.getByText(/View trust & traceability details/i).first(); await d.scrollIntoViewIfNeeded(); await sleep(1000); await d.click(); await sleep(2500); await h.still("trace-open");
      await p.mouse.wheel(0, 450); await sleep(2500); await h.still("trace-hashes"); } },
  { id: "I_studio_widgets", base: "AWS", evidence: "Read-only public demo: AG Studio dashboard with four custom widgets over this API's data",
    run: async (p, h) => { await h.role("JUDGE"); await h.nav("INTELLIGENCE_STUDIO"); await p.waitForSelector('[data-testid="ag-studio-native-container"]', { timeout: 30000 }); await sleep(3500); await h.still("studio-top"); await h.scroll(420); await sleep(3000); await h.still("studio-widgets"); } },
  { id: "J_agent_query", base: "AWS", evidence: "Read-only public demo: live Gemini agent turns (queries C and D) that change the dashboard",
    run: async (p, h) => { await h.role("JUDGE"); await h.nav("INTELLIGENCE_STUDIO"); await p.waitForSelector('[data-testid="ag-studio-native-container"]', { timeout: 30000 }); await sleep(2500); await h.scroll(420); await sleep(1500); await h.still("before-query");
      await p.getByTestId("studio-demo-query-C").click(); await h.idle(); await h.still("query-c");
      await p.getByTestId("studio-filter-pill-ALL").click().catch(() => {}); await sleep(1000);
      await p.getByTestId("studio-demo-query-D").click(); await h.idle(); await p.locator('[data-testid="ag-studio-native-container"]').scrollIntoViewIfNeeded(); await sleep(1500); await h.still("query-d-chart"); } },
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const list = SCENES.filter((s) => !ONLY.length || ONLY.includes(s.id));
  for (const s of list) {
    const base = s.base === "AWS" ? AWS : LOCAL;
    const context = await makeContext(browser, base);
    const page = await context.newPage();
    const t0 = Date.now();
    watch(page, s.id);
    const stills = [];
    const h = {
      role: async (r) => { await page.locator("#role-switcher-desktop").selectOption(r); await sleep(800); },
      nav: async (n) => { await page.getByTestId(`nav-item-${n}`).click(); await sleep(900); },
      btn: (name) => page.getByRole("button", { name }),
      scroll: async (y) => { await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y); await sleep(1000); },
      idle: async () => { await sleep(1000); await page.waitForFunction(() => { const e = document.querySelector('[data-testid="studio-demo-query-A"]'); return e && !e.disabled; }, null, { timeout: 95000 }); await sleep(1500); },
      still: async (name) => { const f = `${s.id}__${name}.png`; const t = (Date.now() - t0) / 1000; await page.screenshot({ path: path.join(CAP, f) }); stills.push({ file: f, name, t }); },
    };
    const started = new Date().toISOString();
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.mouse.move(960, 540);
    await sleep(1200);
    let error = null;
    try { await s.run(page, h); await sleep(1500); } catch (e) { error = String(e).slice(0, 300); console.error(`${s.id}: ${error}`); }
    const video = page.video();
    await context.close();
    const file = `${s.id}.webm`;
    fs.copyFileSync(await video.path(), path.join(REC, file));
    provenance.push({ scene: s.id, source: s.base === "AWS" ? `AWS Lightsail deployment (${new URL(AWS).hostname}), PUBLIC_DEMO_MODE=true` : "Local docker compose `full` profile, fresh volume, PayPal credentials empty",
      captured_at: started, type: "real browser recording (Playwright, 1920x1080) + PNG stills", evidence: s.evidence, recording: file, stills, error });
    console.log(`${error ? "FAIL" : "ok  "} ${s.id}  (${stills.length} stills)`);
  }
  await browser.close();
  // Merge with an earlier run so re-capturing some scenes keeps the record of the others.
  const logPath = path.join(OUT, "work", "capture-log.json");
  const prev = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : { provenance: [], agent_turns: [], money_requests: [] };
  const redone = new Set(provenance.map((p) => p.scene));
  fs.writeFileSync(logPath, JSON.stringify({
    provenance: [...prev.provenance.filter((p) => !redone.has(p.scene)), ...provenance],
    agent_turns: [...prev.agent_turns.filter((t) => !redone.has(t.scene)), ...agentTurns],
    money_requests: [...prev.money_requests.filter((m) => !redone.has(m.scene)), ...moneyRequests],
  }, null, 2));
  console.log("agent engines:", [...new Set(agentTurns.map((t) => `${t.engine}/${t.model}`))].join(", ") || "none");
  console.log("writes:", moneyRequests.map((m) => `${m.request} ${m.status}${m.payout_requested ? " PAYOUT" : ""}`).join("; ") || "none");
})();
