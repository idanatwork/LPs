import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await page.route("**/version.json*", (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ v: "999" }),
  });
});
const seen = [];
page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) seen.push(frame.url()); });
await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#version-toast", { timeout: 8000 });
check("old build reloads once", seen.some((url) => /[?&]_=\d+/.test(url)), seen.join(" "));
await page.waitForFunction(() => !location.search.includes("_="));
check("the reload drops the temporary address parameter", !page.url().includes("_="), page.url());
check("a second mismatch shows the toast instead of looping", await page.locator("#version-toast").innerText() === "גרסה חדשה זמינה — הקש לרענון");
await page.evaluate(() => window.scrollTo(0, 900));
await page.locator("#version-toast").click();
await page.waitForFunction(() => window.scrollY > 700, null, { timeout: 8000 });
check("reload keeps the scroll position", (await page.evaluate(() => window.scrollY)) > 700, String(await page.evaluate(() => window.scrollY)));

const quiet = await context.newPage();
await quiet.route("**/version.json*", (route) => {
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ v: "18" }) });
});
await quiet.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
await quiet.waitForTimeout(400);
const before = quiet.url();
await quiet.evaluate(() => {
  document.getElementById("font-slider-toggle").click();
  window.tefilaBusy = () => true;
});
await quiet.unroute("**/version.json*");
await quiet.route("**/version.json*", (route) => {
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ v: "1000" }) });
});
await quiet.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await quiet.waitForSelector("#version-toast");
check("an open panel shows the toast without reloading", quiet.url() === before, quiet.url());

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
