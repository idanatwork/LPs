import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

async function modeOf(page) {
  return page.evaluate(() => ({
    mode: document.documentElement.getAttribute("data-minyan"),
    stored: localStorage.getItem("tefila-minyan"),
    yachid: document.querySelector('[data-set-minyan="yachid"]')?.getAttribute("aria-pressed"),
    minyan: document.querySelector('[data-set-minyan="minyan"]')?.getAttribute("aria-pressed"),
    hidden: [...document.querySelectorAll(".minyan-only")].filter((el) => getComputedStyle(el).display === "none").length,
    total: document.querySelectorAll(".minyan-only").length,
    tocHidden: (() => {
      const toc = document.querySelector(".toc-minyan");
      return toc ? getComputedStyle(toc).display === "none" : null;
    })(),
    labels: [...document.querySelectorAll("[data-mode-label]")].map((el) => el.textContent),
    status: document.getElementById("mode-status")?.textContent || "",
  }));
}

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();

await page.goto(base + "/tefila/index.html", { waitUntil: "networkidle" });
let state = await modeOf(page);
check("gate default is yachid", state.mode === "yachid" && state.stored === null && state.yachid === "true" && state.minyan === "false", JSON.stringify(state));
check("gate cards say ביחידות", state.labels.every((label) => label.endsWith("ביחידות")) && state.labels.some((label) => label.startsWith("שחרית")), state.labels.join(" | "));

await page.locator("#mode-panel [data-set-minyan='minyan']").click();
state = await modeOf(page);
check("gate click מניין", state.mode === "minyan" && state.stored === "minyan" && state.minyan === "true" && state.yachid === "false" && state.labels.every((label) => label.includes("במניין")), state.labels.join(" | "));
check("gate status mentions minyan", state.status.includes("במניין"));

await page.locator("#mode-panel [data-set-minyan='yachid']").click();
state = await modeOf(page);
check("gate click יחיד hides the minyan choice", state.mode === "yachid" && state.stored === "yachid" && state.yachid === "true" && state.minyan === "false" && state.labels.every((label) => label.endsWith("ביחידות")));

await page.locator("#mode-panel [data-set-minyan='minyan']").click();
await page.locator("#card-shacharit").click();
await page.waitForURL(/shacharit/);
state = await modeOf(page);
check("shacharit keeps minyan after navigation", state.mode === "minyan" && state.stored === "minyan" && state.total > 0 && state.hidden === 0 && state.tocHidden === false, JSON.stringify({ hidden: state.hidden, total: state.total, toc: state.tocHidden }));

await page.locator("header [data-set-minyan='yachid']").click();
state = await modeOf(page);
check("shacharit click יחיד hides every minyan block", state.mode === "yachid" && state.yachid === "true" && state.minyan === "false" && state.hidden === state.total && state.total > 0 && state.tocHidden === true, JSON.stringify({ hidden: state.hidden, total: state.total }));

await page.locator("header [data-set-minyan='minyan']").click();
state = await modeOf(page);
check("shacharit click מניין shows the blocks again", state.mode === "minyan" && state.hidden === 0 && state.tocHidden === false);

for (const name of ["mincha.html", "arvit.html"]) {
  await page.goto(base + "/tefila/" + name, { waitUntil: "networkidle" });
  state = await modeOf(page);
  check(name + " opens in stored minyan", state.mode === "minyan" && state.hidden === 0 && state.minyan === "true" && state.total > 0, JSON.stringify({ mode: state.mode, hidden: state.hidden, total: state.total }));
  await page.locator("header [data-set-minyan='yachid']").click();
  state = await modeOf(page);
  check(name + " יחיד hides blocks", state.mode === "yachid" && state.hidden === state.total && state.yachid === "true" && state.tocHidden === true);
  await page.locator("header [data-set-minyan='minyan']").click();
  state = await modeOf(page);
  check(name + " מניין shows blocks", state.mode === "minyan" && state.hidden === 0 && state.minyan === "true");
}

await page.evaluate(() => localStorage.removeItem("tefila-minyan"));
await page.goto(base + "/tefila/shacharit.html", { waitUntil: "networkidle" });
state = await modeOf(page);
check("no stored value loads yachid", state.mode === "yachid" && state.stored === null && state.hidden === state.total && state.yachid === "true");

await page.evaluate(() => localStorage.setItem("tefila-minyan", "yachid"));
await page.goto(base + "/tefila/mincha.html", { waitUntil: "networkidle" });
state = await modeOf(page);
check("stored yachid stays yachid", state.mode === "yachid" && state.stored === "yachid" && state.hidden === state.total && state.yachid === "true");

const other = await context.newPage();
await other.goto(base + "/tefila/arvit.html", { waitUntil: "networkidle" });
await page.goto(base + "/tefila/index.html", { waitUntil: "networkidle" });
await page.locator("#mode-panel [data-set-minyan='minyan']").click();
await other.waitForFunction(() => document.documentElement.getAttribute("data-minyan") === "minyan");
const synced = await modeOf(other);
check("other tab follows storage", synced.mode === "minyan" && synced.hidden === 0 && synced.minyan === "true", JSON.stringify({ mode: synced.mode, hidden: synced.hidden }));
await page.locator("#mode-panel [data-set-minyan='yachid']").click();
await other.waitForFunction(() => document.documentElement.getAttribute("data-minyan") === "yachid");
const syncedBack = await modeOf(other);
check("other tab returns to yachid", syncedBack.mode === "yachid" && syncedBack.hidden === syncedBack.total && syncedBack.yachid === "true");

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
