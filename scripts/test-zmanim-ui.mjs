import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await page.goto(base + "/tefila/zmanim.html", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".z-info");

const count = await page.locator(".z-info").count();
check("every row has an info button", count >= 14, String(count));

const plag = page.locator(".z-row", { hasText: "פלג המנחה" }).locator(".z-info");
await plag.click();
const plagText = await page.locator("#z-exp-plag").innerText();
const plagOpen = await plag.getAttribute("aria-expanded");
check("plag explanation opens", plagOpen === "true" && plagText.includes("שבעים וחמש") && plagText.includes("אין לערב"), plagText.slice(0, 40));

await page.locator(".z-row", { hasText: "הנץ החמה" }).locator(".z-info").click();
const plagClosed = await page.locator("#z-exp-plag").isHidden();
const netzOpen = await page.locator("#z-exp-sunrise").isVisible();
check("only one explanation stays open", plagClosed && netzOpen);

await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
const dark = await page.evaluate(() => {
  const exp = document.getElementById("z-exp-sunrise");
  const style = getComputedStyle(exp);
  const panel = getComputedStyle(exp);
  return { text: exp.textContent.length, color: style.color, bg: panel.backgroundColor, theme: document.documentElement.getAttribute("data-theme") };
});
check("explanation still renders in dark", dark.theme === "dark" && dark.text > 40 && dark.color !== dark.bg, JSON.stringify(dark));

await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
await plag.click();
check("plag can reopen in light", await page.locator("#z-exp-plag").isVisible());

const section = page.locator("#gra-mga");
await section.locator("summary").click();
check("GRA/MGA section opens", await section.evaluate((el) => el.open) && (await section.innerText()).includes("שעה זמנית"));
const linked = await page.locator('a[href="#gra-mga"]').count();
check("MGA and GRA labels link to the section", linked >= 4, String(linked));

for (const url of ["/tefila/shacharit.html", "/tefila/zmanim.html", "/brachot/asher-yatzar.html"]) {
  await page.goto(base + url, { waitUntil: "domcontentloaded" });
  const box = await page.locator("a.home-btn").boundingBox();
  check("home button " + url, box && box.width >= 44 && box.height >= 44, box && `${Math.round(box.width)}x${Math.round(box.height)}`);
}

await page.setViewportSize({ width: 1100, height: 800 });
await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
const frame = await page.evaluate(() => {
  const before = getComputedStyle(document.querySelector("main"), "::before");
  return { content: before.content, width: before.width, position: before.position };
});
check("desktop side ornament is present", frame.content !== "none" && frame.position === "absolute", JSON.stringify(frame));

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
