// Builds the README brand assets and the Devpost gallery from code (HTML/CSS + SVG, rendered by Playwright).
// Product images are real 1920x1080 captures, only cropped, scaled and framed; nothing in them is edited.
// Sandbox identifiers are covered by labelled "redacted" bars.
// Usage: node scripts/showcase/build-showcase.cjs <captures-dir> <gallery-out-dir> [--only=05,07]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..", "..");
const [CAPS, GALLERY, ...flags] = process.argv.slice(2);
const ONLY = (flags.find((f) => f.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const font = (p) => "file:///" + path.join(ROOT, p).replace(/\\/g, "/");
const INTER = font("node_modules/.pnpm/@fontsource-variable+inter@5.3.0/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2");
const MONO = font("node_modules/.pnpm/@fontsource-variable+jetbrains-mono@5.3.0/node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2");
const cap = (name) => "file:///" + path.join(CAPS, name).replace(/\\/g, "/");
const svg = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const CSS = `
@font-face{font-family:Inter;src:url(${INTER}) format('woff2');font-weight:100 900}
@font-face{font-family:'JetBrains Mono';src:url(${MONO}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0B1220;font-family:Inter,'Segoe UI',sans-serif;color:#fff;-webkit-font-smoothing:antialiased}
.slide{position:relative;width:1920px;height:1080px;overflow:hidden;
  background:radial-gradient(1200px 700px at 85% 10%,rgba(190,242,100,.07),transparent 60%),radial-gradient(900px 600px at 0% 100%,rgba(59,130,246,.08),transparent 60%),#0B1220}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(148,163,184,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.05) 1px,transparent 1px);background-size:48px 48px;mask-image:linear-gradient(180deg,rgba(0,0,0,.9),transparent 85%)}
.top{position:absolute;left:96px;right:96px;top:56px;display:flex;justify-content:space-between;align-items:center;font-size:18px;letter-spacing:3px;font-weight:700;color:#BEF264}
.top .n{color:#64748B;letter-spacing:2px}
.brand{display:flex;align-items:center;gap:14px}
.brand img{width:34px;height:34px}
h1{font-size:68px;line-height:1.04;font-weight:800;letter-spacing:-1.5px}
h1 em{font-style:normal;color:#BEF264}
.lede{font-size:28px;line-height:1.42;color:#CBD5E1;font-weight:400}
.k{font-size:16px;letter-spacing:3px;font-weight:700;color:#BEF264;text-transform:uppercase}
.pill{display:inline-flex;align-items:center;gap:10px;padding:12px 20px;border-radius:999px;background:rgba(190,242,100,.10);border:1.5px solid rgba(190,242,100,.45);color:#E7F9C4;font-size:20px;font-weight:600}
.pill i{width:9px;height:9px;border-radius:50%;background:#BEF264;display:inline-block}
.note{position:absolute;left:96px;bottom:48px;font-size:17px;color:#64748B}
.note b{color:#94A3B8;font-weight:600}
.frame{position:absolute;border-radius:18px;overflow:hidden;border:1.5px solid #2B3A58;box-shadow:0 40px 80px rgba(0,0,0,.55),0 0 0 8px rgba(17,26,46,.65)}
.frame .bar{height:34px;background:#121C31;display:flex;align-items:center;gap:8px;padding-left:16px;border-bottom:1px solid #24324D}
.frame .bar span{width:11px;height:11px;border-radius:50%;background:#2B3A58}
.frame .bar em{margin-left:12px;font-style:normal;font-size:13px;color:#64748B;letter-spacing:.5px}
.crop{position:relative;overflow:hidden}
.crop img{position:absolute;display:block;image-rendering:auto}
.redact{position:absolute;background:#0B1220;border:1.5px dashed #64748B;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94A3B8;font:600 12px Inter;letter-spacing:1px}
.ring{position:absolute;border:3px solid #BEF264;border-radius:12px;box-shadow:0 0 0 6px rgba(190,242,100,.15),0 0 30px rgba(190,242,100,.35)}
.callout{position:absolute;max-width:430px;padding:18px 22px;border-radius:16px;background:#111A2E;border:1.5px solid #BEF264;font-size:21px;line-height:1.35;color:#E2E8F0;box-shadow:0 20px 40px rgba(0,0,0,.45)}
.callout b{color:#BEF264}
.card{background:#111A2E;border:1.5px solid #24324D;border-radius:22px;padding:34px}
.mono{font-family:'JetBrains Mono',monospace}
`;

// A framed crop of a real capture. rect = [x, y, w, h] in source pixels; width = displayed width.
function shot({ file, rect: [x, y, w, h], width, left, top, label = "", redact = [], rings = [] }) {
  const s = width / w;
  const H = Math.round(h * s);
  const red = redact.map(([rx, ry, rw, rh]) => `<div class="redact" style="left:${(rx - x) * s}px;top:${(ry - y) * s}px;width:${rw * s}px;height:${rh * s}px">REDACTED</div>`).join("");
  const rg = rings.map(([rx, ry, rw, rh]) => `<div class="ring" style="left:${(rx - x) * s - 8}px;top:${(ry - y) * s - 8}px;width:${rw * s + 16}px;height:${rh * s + 16}px"></div>`).join("");
  return `<div class="frame" style="left:${left}px;top:${top}px;width:${width}px">
    <div class="bar"><span></span><span></span><span></span><em>${label}</em></div>
    <div class="crop" style="width:${width}px;height:${H}px"><img src="${cap(file)}" style="width:${1920 * s}px;left:${-x * s}px;top:${-y * s}px">${red}${rg}</div></div>`;
}
const header = (n, kicker) => `<div class="grid"></div><div class="top"><div class="brand"><img src="data:image/svg+xml;base64,${Buffer.from(svg("docs/assets/brand/realityproof-logo.svg")).toString("base64")}">REALITYPROOF · ${kicker}</div><div class="n">${n} / 15</div></div>`;
const note = (s) => `<div class="note">${s}</div>`;
const LOGO = () => `data:image/svg+xml;base64,${Buffer.from(svg("docs/assets/brand/realityproof-logo.svg")).toString("base64")}`;
const FLOW = ["Payment provenance", "Evidence", "AI advisory", "Human decision", "Proof Passport"];
const flowRow = (size = 22) => `<div style="display:flex;align-items:center;gap:14px;flex-wrap:nowrap">${FLOW.map((f, i) => `<span class="pill" style="font-size:${size}px"><i></i>${f}</span>${i < FLOW.length - 1 ? `<span style="color:#BEF264;font-size:${size + 4}px">→</span>` : ""}`).join("")}</div>`;
const SRC_AWS = "<b>Real capture</b> · public demo on AWS · synthetic data plus one real PayPal Sandbox record";
const SRC_LOCAL = "<b>Real capture</b> · local full workflow · synthetic case, fictional part, no PayPal call";

const SLIDES = [
  ["01_REALITYPROOF_HERO", () => `<div class="grid"></div>
    <div style="position:absolute;left:110px;top:150px;width:900px">
      <div style="display:flex;align-items:center;gap:22px;margin-bottom:46px"><img src="${LOGO()}" style="width:88px;height:88px"><span style="font-size:30px;font-weight:800;letter-spacing:8px">REALITYPROOF</span></div>
      <h1 style="font-size:104px;letter-spacing:-3px">Trust what's <em>real.</em></h1>
      <p class="lede" style="margin-top:30px;font-size:34px;max-width:820px">Evidence-first verification for AI-powered commerce.</p>
      <p class="lede" style="margin-top:22px;font-size:24px;color:#94A3B8;max-width:780px">Before money moves, a person photographs the item, Gemini advises, a human decides, and a Proof Passport records what was checked and what wasn't.</p>
    </div>
    ${shot({ file: "H_passport_synthetic__passport-limits.png", rect: [500, 300, 1200, 740], width: 820, left: 1010, top: 190, label: "Proof Passport · synthetic case" })}
    <div style="position:absolute;left:110px;bottom:120px">${flowRow(21)}</div>
    ${note("Prototype built for the PayPal AI Hackathon 2026 · PayPal Sandbox (test money) · synthetic evidence")}`],

  ["02_THE_TRUST_GAP", () => `${header("02", "THE TRUST GAP")}
    <div style="position:absolute;left:96px;top:170px;width:1500px">
      <h1>A payment proves money moved.<br><em>Not that the right part is on the shelf.</em></h1>
    </div>
    <div style="position:absolute;left:96px;top:520px;display:flex;gap:36px">
      ${[["Agents can pay in seconds", "AI agents compare prices and start checkouts on their own."],
         ["Nobody checks the shelf", "No API can tell whether the exact SKU is physically there before the money moves."],
         ["Proof is easy to overstate", "A matching label, a photo or a hash feels like proof. None of them proves a part is genuine."]]
        .map(([h, t], i) => `<div class="card" style="width:552px;height:330px"><div class="k" style="margin-bottom:22px">0${i + 1}</div><div style="font-size:36px;font-weight:700;margin-bottom:18px">${h}</div><div class="lede" style="font-size:24px">${t}</div></div>`).join("")}
    </div>
    ${note("RealityProof closes this gap with evidence, an advisory AI and a human decision, and says plainly what remains unproven.")}`],

  ["03_HOW_IT_WORKS", () => `<div style="position:absolute;left:0;top:0">${svg("docs/assets/diagrams/verification-workflow.svg").replace('width="1600" height="720"', 'width="1920" height="864"')}</div>
    <div style="position:absolute;left:0;top:864px;width:1920px;height:216px;background:#0B1220;display:flex;align-items:center;padding-left:72px">${flowRow(24)}</div>`],

  ["04_SYSTEM_ARCHITECTURE", () => `<div style="position:absolute;left:60px;top:0">${svg("docs/assets/architecture/system-architecture.svg").replace('width="1600" height="960"', 'width="1800" height="1080"')}</div>`],

  ["05_REQUESTER_DASHBOARD", () => `${header("05", "PRODUCT · REQUESTER")}
    <div style="position:absolute;left:96px;top:160px;width:560px"><h1>Every request<br><em>at a glance.</em></h1>
      <p class="lede" style="margin-top:28px">Each card says where its money came from: a real Sandbox capture, labelled demo funding, or nothing yet.</p></div>
    ${shot({ file: "A_requester_dashboard__dashboard.png", rect: [490, 300, 1200, 680], width: 1120, left: 720, top: 170, label: "Requester dashboard", rings: [[1414, 318, 270, 160]] })}
    <div class="callout" style="left:1220px;top:860px">Only the <b>real Sandbox capture</b> counts as confirmed money. Demo funding is shown, never counted.</div>
    ${note(SRC_AWS)}`],

  ["06_VALUE_OF_INFORMATION", () => `${header("06", "PRODUCT · VALUE OF INFORMATION")}
    <div style="position:absolute;left:96px;top:160px;width:600px"><h1>Buy a check only<br><em>when it's worth it.</em></h1>
      <div class="card" style="margin-top:44px;padding:30px 34px"><div class="k">Value of Information</div>
        <div class="mono" style="font-size:54px;color:#BEF264;margin:18px 0">(p × L) − C</div>
        <div class="lede" style="font-size:22px">C: the verification fee · L: the loss if the part is wrong · <b style="color:#fff">p: a risk you declare</b>, not a measured probability.</div></div></div>
    ${shot({ file: "B_new_verification_voi__voi-review.png", rect: [520, 120, 1000, 780], width: 1000, left: 800, top: 170, label: "New verification · cost & risk" })}
    ${note(SRC_LOCAL)}`],

  ["07_PAYPAL_SANDBOX_PROVENANCE", () => `${header("07", "PAYPAL INTEGRATION")}
    <div style="position:absolute;left:96px;top:160px;width:600px"><h1>Money with<br><em>a paper trail.</em></h1>
      <p class="lede" style="margin-top:28px">PayPal Orders v2 takes the fee in Sandbox test money. The server confirms the capture with PayPal and binds it to exactly one contract.</p>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:36px;align-items:flex-start">
        <span class="pill"><i></i>Orders v2 · capture confirmed server-side</span>
        <span class="pill"><i></i>Payouts never run automatically</span>
        <span class="pill"><i></i>An UNCLAIMED payout is not a paid one</span></div></div>
    ${shot({ file: "C2_traceability__trace-ids.png", rect: [500, 640, 1200, 440], width: 1080, left: 760, top: 300, label: "Proof Passport · trust & traceability · historical Sandbox record",
      redact: [[855, 980, 245, 80], [1160, 1034, 540, 46]] })}
    ${note("<b>Real capture</b> · public demo on AWS · PayPal Sandbox record from Oct 28, 2026 (test money) · identifiers redacted in this image")}`],

  ["08_GUIDED_VERIFICATION", () => `${header("08", "PRODUCT · VERIFIER")}
    <div style="position:absolute;left:96px;top:160px;width:560px"><h1>A checklist,<br><em>not a hunch.</em></h1>
      <p class="lede" style="margin-top:28px">The verifier fills one slot per required view. The server checks type, size, SHA-256, duplicates and missing views before anyone can decide.</p></div>
    ${shot({ file: "D_verifier_guided_capture__checklist.png", rect: [500, 100, 1180, 880], width: 1060, left: 760, top: 160, label: "Verifier · guided capture" })}
    ${note(SRC_LOCAL)}`],

  ["09_SYNTHETIC_EVIDENCE", () => `${header("09", "HONEST DATA")}
    <div style="position:absolute;left:96px;top:160px;width:600px"><h1>Synthetic,<br><em>and labelled so.</em></h1>
      <p class="lede" style="margin-top:28px">The photos are generated fixtures of a fictional brand, FictoParts. The case is paid with demo money that can never become a payout.</p>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:36px;align-items:flex-start">
        <span class="pill"><i></i>DEMO_SYNTHETIC fixture</span><span class="pill"><i></i>Demo funding · no real money</span></div></div>
    ${shot({ file: "D_verifier_guided_capture__status.png", rect: [520, 600, 1150, 480], width: 1060, left: 760, top: 150, label: "Delivered photograph · synthetic fixture" })}
    ${shot({ file: "D0_synthetic_funding__demo-funding.png", rect: [500, 220, 800, 340], width: 760, left: 760, top: 660, label: "Synthetic funding · no PayPal call", rings: [[660, 330, 230, 26]] })}
    ${note(SRC_LOCAL)}`],

  ["10_GEMINI_AI_ANALYSIS", () => `${header("10", "GEMINI · ADVISORY")}
    <div style="position:absolute;left:96px;top:160px;width:600px"><h1>Gemini says what<br><em>it can't see.</em></h1>
      <p class="lede" style="margin-top:28px">A live multimodal call reads the label, then lists its limits. Here it notices the photos are synthetic labels and asks for more evidence.</p>
      <div class="card" style="margin-top:34px;padding:26px 30px"><div class="mono" style="color:#FBBF24;font-size:24px">INSUFFICIENT_EVIDENCE</div>
        <div class="lede" style="font-size:21px;margin-top:10px">Not a failure: a conservative answer that refuses to promise physical authenticity without proof.</div></div></div>
    ${shot({ file: "E_gemini_analysis__gemini-uncertainties.png", rect: [780, 240, 1000, 760], width: 1000, left: 800, top: 160, label: "Operator desk · live Gemini output" })}
    ${note("<b>Real capture</b> · live Gemini call (gemini-3.5-flash-lite) on synthetic fixture photos · local full workflow")}`],

  ["11_HUMAN_IN_THE_LOOP", () => `${header("11", "HUMAN IN THE LOOP")}
    <div style="position:absolute;left:96px;top:160px;width:640px"><h1>A person<br><em>makes the call.</em></h1>
      <p class="lede" style="margin-top:28px">The operator is neither the requester nor the verifier. A SKU match never approves anything on its own: every decision needs a written justification and a confirmation.</p>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:36px;align-items:flex-start">
        <span class="pill"><i></i>No auto-approval</span><span class="pill"><i></i>Separation of duties, enforced by the server</span><span class="pill"><i></i>No payout unless explicitly requested</span></div></div>
    ${shot({ file: "G_human_review__justification.png", rect: [1290, 330, 440, 560], width: 760, left: 1040, top: 150, label: "Deterministic human decision gate" })}
    ${note(SRC_LOCAL)}`],

  ["12_PROOF_PASSPORT", () => `${header("12", "PROOF PASSPORT")}
    <div style="position:absolute;left:96px;top:160px;width:1700px"><h1>A record that <em>states its limits.</em></h1>
      <p class="lede" style="margin-top:22px;max-width:1300px">Gemini's observations, the verifier's declarations and what could not be verified sit side by side, never blended.</p></div>
    ${shot({ file: "H_passport_synthetic__passport-limits.png", rect: [500, 300, 1200, 620], width: 1150, left: 385, top: 350, label: "Proof Passport · synthetic case" })}
    ${note(SRC_LOCAL)}`],

  ["13_INTEGRITY_VERIFICATION", () => `${header("13", "INTEGRITY")}
    <div style="position:absolute;left:96px;top:160px;width:620px"><h1>Re-check the<br><em>fingerprint.</em></h1>
      <p class="lede" style="margin-top:28px">The passport is fetched again through a time-limited HMAC-signed link and compared with its canonical SHA-256 manifest.</p>
      <div class="card" style="margin-top:34px;padding:26px 30px"><div style="font-size:26px;font-weight:700">Intact record ≠ genuine part.</div>
        <div class="lede" style="font-size:21px;margin-top:10px">A hash proves nothing was changed after the fact. It says nothing about the physical object.</div></div></div>
    ${shot({ file: "H3_integrity_check__integrity-verified.png", rect: [500, 760, 1180, 300], width: 1040, left: 800, top: 200, label: "Share, export & verify integrity", rings: [[524, 1018, 1140, 40]] })}
    ${shot({ file: "H3_integrity_check__trace-hashes.png", rect: [520, 590, 1160, 490], width: 940, left: 880, top: 520, label: "Provenance matrix · identifiers · SHA-256 per evidence file" })}
    ${note(SRC_LOCAL)}`],

  ["14_AGENTIC_INTELLIGENCE", () => `${header("14", "AGENTIC INTELLIGENCE")}
    <div style="position:absolute;left:96px;top:160px;width:640px"><h1 style="font-size:60px">It changes the dashboard.<br><em>Never the money.</em></h1>
      <p class="lede" style="margin-top:26px;font-size:24px">Gemini function calling inside an AG Studio dashboard. Ask in plain language and it calls a short list of read-only tools.</p>
      <div class="mono" style="margin-top:26px;font-size:19px;line-height:1.75;color:#BEF264">add_evidence_chart<br>filter_intelligence_studio<br>compare_voi_economics<br>explain_financial_provenance<br>open_verification_case · open_proof_passport</div>
      <p class="lede" style="margin-top:22px;font-size:21px;color:#94A3B8">Requests to pay, approve or reveal secrets are refused, and any other tool is stripped by the server.</p></div>
    ${shot({ file: "J_agent_query__query-d-chart.png", rect: [880, 100, 680, 400], width: 900, left: 900, top: 150, label: "Agent result · tool add_evidence_chart · live Gemini" })}
    ${shot({ file: "J_agent_query__query-c.png", rect: [550, 455, 1100, 250], width: 900, left: 900, top: 740, label: "Agent reply · tool explain_financial_provenance", redact: [[700, 584, 620, 30]] })}
    ${note("<b>Real capture</b> · public demo on AWS · live Gemini agent turns · AG Studio 3.1")}`],

  ["15_REAL_WORLD_IMPACT", () => `${header("15", "IMPACT")}
    <div style="position:absolute;left:96px;top:160px;width:1700px"><h1>Where <em>proof before payment</em> matters.</h1></div>
    <div style="position:absolute;left:96px;top:390px;display:flex;gap:36px">
      ${[["Spare parts and MRO", "A wrong part means downtime and returns. A check costs less than the mistake, and the calculator says when."],
         ["Marketplaces and resale", "Buyers fund a neutral check before paying a seller they don't know."],
         ["Agent-led purchasing", "An agent can commission the check itself through the REST API, then wait for a human decision."]]
        .map(([h, t]) => `<div class="card" style="width:552px;height:300px"><div style="font-size:34px;font-weight:700;margin-bottom:18px">${h}</div><div class="lede" style="font-size:23px">${t}</div></div>`).join("")}</div>
    <div style="position:absolute;left:96px;top:760px;width:1730px" class="card"><div class="k" style="margin-bottom:14px">Next steps</div>
      <div class="lede" style="font-size:23px">Real camera capture with device attestation · user accounts instead of role tokens · a database instead of one JSON file · pilots with real buyers and verifiers.</div></div>
    ${note("Prototype: PayPal Sandbox only, synthetic evidence, no external user study yet.")}`],
];

const COVER = () => `<div class="slide" style="width:1500px;height:1000px"><div class="grid"></div>
  <div style="position:absolute;left:90px;top:110px;width:760px">
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:40px"><img src="${LOGO()}" style="width:80px;height:80px"><span style="font-size:28px;font-weight:800;letter-spacing:7px">REALITYPROOF</span></div>
    <h1 style="font-size:92px;letter-spacing:-2.5px">Trust what's<br><em>real.</em></h1>
    <p class="lede" style="margin-top:30px;font-size:32px">Evidence-first verification for AI-powered commerce.</p></div>
  ${shot({ file: "H_passport_synthetic__passport-limits.png", rect: [500, 300, 1200, 740], width: 600, left: 840, top: 300, label: "Proof Passport" })}
  <div style="position:absolute;left:90px;bottom:90px;transform:scale(.86);transform-origin:left bottom">${flowRow(20)}</div></div>`;

const HERO = () => `<div class="slide" style="width:1600px;height:640px"><div class="grid"></div>
  <div style="position:absolute;left:80px;top:82px;width:860px">
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:34px"><img src="${LOGO()}" style="width:64px;height:64px"><span style="font-size:24px;font-weight:800;letter-spacing:7px">REALITYPROOF</span></div>
    <h1 style="font-size:84px;letter-spacing:-2.5px">Trust what's <em>real.</em></h1>
    <p class="lede" style="margin-top:22px;font-size:30px">Evidence-first verification for AI-powered commerce.</p></div>
  ${shot({ file: "H_passport_synthetic__passport-limits.png", rect: [500, 300, 1200, 740], width: 560, left: 990, top: 70, label: "Proof Passport · synthetic case" })}
  <div style="position:absolute;left:80px;bottom:62px;transform:scale(.92);transform-origin:left bottom">${flowRow(19)}</div></div>`;

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body style="width:${w}px;height:${h}px">${body}</body></html>`;

(async () => {
  const browser = await chromium.launch({ channel: "msedge" });
  const render = async (html, w, h, out, scale = 1) => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    const tmp = path.join(path.dirname(out), `.render-${path.basename(out)}.html`);
    fs.writeFileSync(tmp, html);
    await p.goto("file:///" + tmp.replace(/\\/g, "/"));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
    await p.close();
    fs.unlinkSync(tmp);
    console.log("wrote", path.relative(process.cwd(), out));
  };
  const A = path.join(ROOT, "docs", "assets");
  if (!ONLY.length || ONLY.includes("brand")) {
    await render(page(`<img src="${LOGO()}" style="width:512px;height:512px;display:block">`, 512, 512), 512, 512, path.join(A, "brand", "realityproof-logo.png"));
    await render(page(HERO(), 1600, 640), 1600, 640, path.join(A, "brand", "realityproof-hero.png"));
    await render(page(svg("docs/assets/architecture/system-architecture.svg"), 1600, 960), 1600, 960, path.join(A, "architecture", "system-architecture.png"), 1.5);
    await render(page(svg("docs/assets/diagrams/verification-workflow.svg"), 1600, 720), 1600, 720, path.join(A, "diagrams", "verification-workflow.png"), 1.5);
  }
  if (GALLERY) {
    fs.mkdirSync(GALLERY, { recursive: true });
    for (const [name, body] of SLIDES) {
      if (ONLY.length && !ONLY.includes(name.slice(0, 2))) continue;
      await render(page(`<div class="slide">${body()}</div>`, 1920, 1080), 1920, 1080, path.join(GALLERY, `${name}.png`));
    }
    if (!ONLY.length || ONLY.includes("cover")) await render(page(COVER(), 1500, 1000), 1500, 1000, path.join(GALLERY, "00_DEVPOST_COVER_3x2.png"));
  }
  await browser.close();
})();
