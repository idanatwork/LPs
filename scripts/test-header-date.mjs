import { chromium } from "playwright-core";
import { formatHeaderDate, isNightService, statusFor } from "../tefila/day-status.mjs";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

const now = new Date();
const expected = {
  shacharit: formatHeaderDate(statusFor(now, "shacharit"), isNightService(now, "shacharit")),
  mincha: formatHeaderDate(statusFor(now, "mincha"), isNightService(now, "mincha")),
  arvit: formatHeaderDate(statusFor(now, "arvit"), isNightService(now, "arvit")),
};
console.log("TODAY shacharit:", expected.shacharit);
console.log("TODAY mincha:", expected.mincha);
console.log("TODAY arvit:", expected.arvit);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: iphone,
});
const page = await context.newPage();

for (const name of ["shacharit", "mincha", "arvit"]) {
  await page.goto(base + "/tefila/" + name + ".html", { waitUntil: "networkidle" });
  const date = page.locator("#header-date");
  const text = (await date.innerText()).trim();
  check(name + " shows the computed date", text === expected[name], text);
  const dateBox = await date.boundingBox();
  const buttons = await page.locator("header.bar button, header.bar a.home-btn").all();
  let overlap = false;
  for (const button of buttons) {
    const box = await button.boundingBox();
    if (!box || !dateBox) continue;
    const separated = dateBox.y >= box.y + box.height - 1 || box.y >= dateBox.y + dateBox.height - 1 || dateBox.x >= box.x + box.width - 1 || box.x >= dateBox.x + dateBox.width - 1;
    if (!separated) overlap = true;
  }
  check(name + " date does not cover the header controls", !overlap && dateBox && dateBox.width <= 390);
  const home = await page.locator("a.home-btn").boundingBox();
  const title = await page.locator(".brand strong").boundingBox();
  const between = dateBox.x < home.x ? dateBox.x + dateBox.width <= home.x + 2 && title.x + title.width <= dateBox.x + 2 : dateBox.x + dateBox.width <= title.x + 2 && home.x + home.width <= dateBox.x + 2;
  check(name + " date sits between home and title", between);
  const tops = await page.locator("header.bar .szs button, header.bar .szs .mode-switch").evaluateAll((nodes) => {
    const visible = nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
    });
    return [...new Set(visible.map((node) => Math.round(node.getBoundingClientRect().top / 8) * 8))];
  });
  check(name + " controls stay on one row", tops.length === 1, tops.join(","));
}
for (const width of [375, 393]) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(base + "/tefila/shacharit.html", { waitUntil: "networkidle" });
  const height = Math.round((await page.locator("header.bar").boundingBox()).height);
  console.log("HEADER", width, height);
  check("header at " + width + " is one brand row plus one control row", height < 150, String(height));
}

await page.goto(base + "/brachot/birkat-hamazon.html", { waitUntil: "networkidle" });
const bracha = (await page.locator("#header-date").innerText()).trim();
check("birkat hamazon uses the sunset date", bracha === expected.shacharit, bracha);

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
