// Records the real product in one take, paced to the narration. Makes no PayPal call.
// Usage: node scripts/video/record.cjs <http://localhost:8081> <work-dir>
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const [BASE, WORK] = process.argv.slice(2);
const seconds = (id) =>
  Number(
    execFileSync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
      path.join(WORK, `${id}.wav`),
    ]).toString()
  );
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: { dir: path.join(WORK, "raw"), size: { width: 1600, height: 900 } },
  });
  const page = await context.newPage();
  const started = Date.now();
  const marks = [];
  const turns = [];
  const decisions = [];
  page.on("response", async (r) => {
    if (r.url().includes("studio-agent-turn")) {
      const j = await r.json().catch(() => ({}));
      turns.push({
        http: r.status(),
        engine: j.meta?.engine,
        model: j.meta?.model_id,
        degraded: (j.meta?.degraded_reason ?? "").slice(0, 100) || null,
        tools: (j.output ?? []).filter((o) => o.type === "function_call").map((o) => o.name),
      });
    }
    if (/funding\/(create-order|capture-order)|\/review$|\/analyze/.test(r.url())) {
      const asksPayout = r.request().postData()?.includes('"attempt_sandbox_payout":true');
      decisions.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}${asksPayout ? " PAYOUT_REQUESTED" : ""}`);
    }
  });
  const scene = async (id, action) => {
    const t0 = Date.now();
    const mark = { id, start: (t0 - started) / 1000, audio: seconds(id) };
    marks.push(mark);
    await action();
    const remaining = mark.audio * 1000 + 350 - (Date.now() - t0);
    if (remaining > 0) await sleep(remaining);
    mark.end = (Date.now() - started) / 1000;
    console.log(`${id}: ${(mark.end - mark.start).toFixed(1)}s (audio ${mark.audio.toFixed(1)}s)`);
  };
  const role = async (r) => {
    await page.locator("#role-switcher-desktop").selectOption(r);
    await sleep(600);
  };
  const nav = async (n) => {
    await page.getByTestId(`nav-item-${n}`).click();
    await sleep(700);
  };
  const button = (name) => page.getByRole("button", { name });
  const idle = async () => {
    await sleep(1000);
    await page.waitForFunction(
      () => {
        const e = document.querySelector('[data-testid="studio-demo-query-A"]');
        return e && !e.disabled;
      },
      null,
      { timeout: 95000 }
    );
    await sleep(600);
  };
  const canvas = () => page.locator('[data-testid="ag-studio-native-container"]');
  const smoothScroll = async (y) => {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
    await sleep(900);
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await sleep(800);

  await scene("problem", async () => {
    await role("REQUESTER");
    await nav("DASHBOARD");
  });
  await scene("contract", async () => {
    await nav("NEW_VERIFICATION");
    await sleep(3200);
    await button(/^Continue/).click().catch(() => {});
    await sleep(3000);
    await button(/^Continue/).click().catch(() => {});
    await sleep(800);
  });
  await scene("paypal", async () => {
    await role("JUDGE");
    await nav("TOUR");
    await sleep(5500);
    await nav("SANDBOX_PROOF");
    await sleep(1500);
    await smoothScroll(420);
  });
  await scene("fund", async () => {
    await smoothScroll(0);
    await role("REQUESTER");
    await nav("MY_VERIFICATIONS");
    await button(/FictoParts KX-20 Fuel Injector/i).first().click();
    await sleep(1500);
    await button(/Simulate DEMO funding/i).click();
    await sleep(800);
  });
  await scene("verifier", async () => {
    await role("VERIFIER");
    await nav("TASKS");
    await button(/Start verification/i).first().click();
    await sleep(1600);
    await button(/Capture next photo/i).click();
    await sleep(800);
    for (let i = 0; i < 3; i += 1) {
      await button(/Load matching SKU fixture/i).click();
      await sleep(1400);
      await button(/Send .* to server/i).click();
      await sleep(1500);
    }
    await button(/4\. Status/i).click().catch(() => {});
  });
  await scene("gemini", async () => {
    await role("OPERATOR");
    await nav("DECISION_CENTER");
    await button(/FictoParts KX-20 Fuel Injector/i).first().click().catch(() => {});
    await sleep(900);
    // A live call: retry on a transient model error, but never show a result that did not come back.
    for (let attempt = 1; ; attempt += 1) {
      await button(/Run Gemini Inspection|Re-run Gemini/i).first().click();
      const shown = await page
        .getByText(/Visual\s+Observations/i)
        .first()
        .waitFor({ timeout: 25000 })
        .then(() => true, () => false);
      if (shown) break;
      if (attempt === 3) throw new Error("Gemini analysis did not return after 3 attempts");
      await sleep(4000);
    }
    await sleep(1500);
    await page.getByText(/Inspected Pixels/i).first().evaluate((e) => e.scrollIntoView({ block: "start", behavior: "smooth" })).catch(() => {});
    await sleep(2800);
    await page.getByText(/Uncertainties/i).first().evaluate((e) => e.scrollIntoView({ block: "center", behavior: "smooth" })).catch(() => {});
    await sleep(2800);
  });
  await scene("human", async () => {
    await button(/Insert complete visual verification note/i).scrollIntoViewIfNeeded();
    await sleep(700);
    await button(/Insert complete visual verification note/i).click();
    await sleep(1300);
    await button(/Approve & issue Passport/i).click();
    await sleep(1400);
    await button(/Confirm & Record Decision/i).click();
    await sleep(1000);
  });
  await scene("passport", async () => {
    await button(/Open Proof Passport/i).first().click();
    await sleep(1800);
    await smoothScroll(0);
    await sleep(2500);
    await smoothScroll(650);
    await sleep(2500);
  });
  await scene("studio_a", async () => {
    await nav("INTELLIGENCE_STUDIO");
    await page.waitForSelector('[data-testid="ag-studio-native-container"]');
    await sleep(2500);
    await smoothScroll(420);
    await sleep(3500);
    await page.getByTestId("studio-demo-query-A").click();
    await idle();
  });
  await scene("studio_c", async () => {
    await page.getByTestId("studio-demo-query-C").click();
    await idle();
    await page.getByTestId("custom-widget-financial-provenance").scrollIntoViewIfNeeded().catch(() => {});
  });
  await scene("studio_d", async () => {
    await page.getByTestId("studio-filter-pill-ALL").click();
    await sleep(900);
    await page.getByTestId("studio-demo-query-D").click();
    await idle();
    await canvas().scrollIntoViewIfNeeded();
  });
  await scene("studio_e", async () => {
    await page.getByTestId("studio-demo-query-E").click();
    await idle();
  });
  await scene("close", async () => {
    await smoothScroll(0);
  });

  const video = page.video();
  await context.close();
  await browser.close();
  fs.copyFileSync(await video.path(), path.join(WORK, "take.webm"));
  fs.writeFileSync(path.join(WORK, "timeline.json"), JSON.stringify({ marks, turns, decisions }, null, 1));
  console.log("engines:", [...new Set(turns.map((t) => t.engine))].join(","), "| requests:", decisions.join("; ") || "none");
})().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
