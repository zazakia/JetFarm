#!/usr/bin/env node
/**
 * Visible-Chrome E2E walk of every routed screen in the JetFarm web app.
 *
 * Logs in with the LOCAL seed account, dismisses the onboarding tour, then
 * visits each route, screenshots it, and records what actually rendered plus
 * any console/page errors. Read-only: it never writes to the database and it
 * refuses to run unless the app's Supabase URL is a loopback host.
 *
 *   node scripts/e2e-module-walk.mjs                 # headed Chrome (watch it)
 *   node scripts/e2e-module-walk.mjs --headless      # same walk, no window
 *   node scripts/e2e-module-walk.mjs --only=modules  # filter routes by substring
 *
 * Evidence: tmp/systematic-test-matrix/<dir>/e2e-walk/  (screenshots + walk.json)
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const APP_URL = process.env.E2E_WALK_BASE_URL || "http://127.0.0.1:8081";
const EMAIL = process.env.E2E_WALK_EMAIL || "admin@poscursor.com";
const PASSWORD = process.env.E2E_WALK_PASSWORD || "12345678";
const OUT_DIR =
  process.env.E2E_WALK_OUT ||
  path.join("tmp", "systematic-test-matrix", "e2e-walk");
const args = process.argv.slice(2);
const headed = !args.includes("--headless");
const onlyFlag = args.find((a) => a.startsWith("--only="));
const only = onlyFlag ? onlyFlag.slice("--only=".length) : null;

const ADMIN = [
  "/", "agribusiness", "accounting", "areas", "bank-accounts", "borrowers",
  "cash-on-hand", "cic", "collectors", "expenses", "file-cases", "franchise",
  "groups", "loan-approvals", "loans", "marketplace", "modules", "payments",
  "payroll", "returns", "settings", "transfers", "users",
];
const MODULES = [
  "modules", "modules/agri-store", "modules/pharmacy", "modules/transport",
  "modules/water-station", "modules/water-station/customers",
  "modules/water-station/deliveries", "modules/water-station/inventory",
  "modules/water-station/history",
];
const CASHIER = ["pos", "shift-open", "shift-close", "cash-drop", "returns"];

const ROUTES = [...ADMIN, ...MODULES, ...CASHIER].map((r) => ({
  name: r === "/" ? "hub" : r,
  url: `${APP_URL}/${r}`.replace(/\/+$/, "") || APP_URL,
}));

const ERROR_MARKERS = [
  "Something went wrong",
  "Application Error",
  "Unhandled Runtime Error",
  "Failed to fetch",
  "Network Error",
];

// Resolve and validate the backend the bundle would talk to BEFORE opening a
// browser or writing any evidence. The bundle bakes EXPO_PUBLIC_SUPABASE_URL
// from .env.local, so that file is the authority on which database this run
// would use.
const assertLoopbackBackend = () => {
  const envLocal = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
  const backendUrl =
    (envLocal.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m) || [])[1] || "";
  let backendHost = "";
  try {
    backendHost = new URL(backendUrl).hostname;
  } catch {
    /* leave empty -> refused below */
  }
  if (!/^(127\.0\.0\.1|localhost|\[::1\])$/.test(backendHost)) {
    throw new Error(
      `refusing to walk: .env.local EXPO_PUBLIC_SUPABASE_URL host is "${backendHost || "unset"}", not loopback`
    );
  }
  return backendHost;
};

const main = async () => {
  const backendHost = assertLoopbackBackend();
  console.log(`backend host guard: ${backendHost} (loopback) OK`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: !headed,
    channel: "chrome",
    args: ["--window-size=1440,950"],
  });
  try {
    await walk(browser);
  } finally {
    await browser.close().catch(() => {});
  }
};

const walk = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ where: "unknown", text: msg.text().slice(0, 300) });
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push({ where: "unknown", text: `PAGEERROR ${String(err).slice(0, 300)}` });
  });

  await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // --- login -----------------------------------------------------------
  const inputs = page.locator("input");
  await inputs.nth(0).waitFor({ timeout: 90000 });
  await inputs.nth(0).fill(EMAIL);
  await inputs.nth(1).fill(PASSWORD);
  // The button label is lower-case in the DOM and upper-cased by CSS
  // (textTransform), so an exact "SIGN IN" match never resolves.
  const signIn = page.getByText(/sign\s*in/i).first();
  if (await signIn.isVisible({ timeout: 15000 }).catch(() => false)) {
    await signIn.click();
  } else {
    await inputs.nth(1).press("Enter");
  }
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60000 });
  const landedUrl = page.url();

  // onboarding tour blocks clicks on web (documented harness trap)
  const skip = page.getByText(/skip tour/i).first();
  if (await skip.count()) {
    await skip.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // --- walk ------------------------------------------------------------
  const results = [];
  for (const route of ROUTES) {
    if (only && !route.name.includes(only)) continue;
    const before = consoleErrors.length;
    let status = "ok";
    let note = "";
    try {
      await page.goto(route.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2200);
      const view = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        return {
          url: location.href,
          chars: text.length,
          sample: text.replace(/\s+/g, " ").trim().slice(0, 180),
          inputs: document.querySelectorAll("input").length,
          buttons: document.querySelectorAll("[role=button],button").length,
        };
      });
      if (view.url !== route.url && !view.url.startsWith(route.url)) {
        // A route that bounced elsewhere never rendered its own screen. Call
        // that out as "gated" instead of counting it as a pass.
        status = "gated";
        note = `redirected -> ${view.url.replace(APP_URL, "")}`;
      }
      if (view.chars < 40) {
        status = "blank";
        note = note || `only ${view.chars} chars rendered`;
      }
      const hit = ERROR_MARKERS.find((m) => view.sample.includes(m));
      if (hit) {
        status = "error";
        note = `${hit}: ${view.sample.slice(0, 120)}`;
      }
      const file = path.join(OUT_DIR, `${String(results.length + 1).padStart(2, "0")}-${route.name.replace(/[^\w.-]+/g, "_")}.png`);
      await page.screenshot({ path: file, fullPage: false });
      results.push({
        route: route.name,
        status,
        note,
        ...view,
        screenshot: path.relative(process.cwd(), file).split(path.sep).join("/"),
        newConsoleErrors: consoleErrors.length - before,
      });
      console.log(`${status.toUpperCase().padEnd(5)} ${route.name.padEnd(34)} ${view.chars}ch ${note}`);
    } catch (err) {
      status = "fail";
      note = String(err.message || err).slice(0, 160);
      results.push({ route: route.name, status, note, url: route.url });
      console.log(`FAIL  ${route.name.padEnd(34)} ${note}`);
    }
  }

  const summary = {
    startedAt: new Date().toISOString(),
    appUrl: APP_URL,
    headed,
    landedUrl,
    routes: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    gated: results.filter((r) => r.status === "gated").length,
    blank: results.filter((r) => r.status === "blank").length,
    error: results.filter((r) => r.status === "error").length,
    fail: results.filter((r) => r.status === "fail").length,
    consoleErrorTotal: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 60),
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, "walk.json"), JSON.stringify(summary, null, 2));
  console.log(
    `\n== ${summary.ok} ok / ${summary.gated} gated / ${summary.blank} blank / ${summary.error} error / ${summary.fail} fail ==`,
    `\nEvidence: ${OUT_DIR}/walk.json`
  );
};

main().catch((err) => {
  console.error("WALK ABORTED:", err.message);
  process.exit(1);
});
