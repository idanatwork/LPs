import { chromium } from "playwright-core";
import { mkdirSync } from "fs";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const G = "\u05f4";
const lines = [
  "לעילוי נשמת",
  `עדי עדיאל טויטו הי${G}ד`,
  `בת אילנה ויורם שיבל${G}ט`,
  "שנרצחה על קידוש השם בטבח שמחת תורה",
  `כ${G}ב בתשרי תשפ${G}ד`,
  "ת.נ.צ.ב.ה.",
];
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

mkdirSync("/opt/cursor/artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});

const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
  userAgent: iphone,
  colorScheme: "dark",
});
const page = await context.newPage();
await page.addInitScript(() => localStorage.setItem("tefila-theme", "dark"));
await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
const splash = page.locator("#memorial-splash");
check("splash is visible on load", await splash.isVisible());
const got = await splash.locator("p").allInnerTexts();
check("dedication text is exact", got.join("\n") === lines.join("\n"), got.join(" | "));
const latin = await splash.innerText();
check("splash shows no English letters", !/[A-Za-z]/.test(latin));
const nameSize = await splash.locator(".memorial-name").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const otherSize = await splash.locator(".memorial-kicker").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
check("the name line is the largest", nameSize > otherSize + 8, nameSize + " vs " + otherSize);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
check("splash does not widen the page", overflow);
await splash.screenshot({ path: "/opt/cursor/artifacts/memorial-splash-iphone.png" });
await page.screenshot({ path: "/opt/cursor/artifacts/memorial-splash-iphone-full.png" });

await splash.click();
await page.waitForTimeout(700);
check("a tap dismisses the splash", await splash.count() === 0);

await page.goto(base + "/tefila/mincha.html", { waitUntil: "domcontentloaded" });
check("the splash stays down for the rest of the visit", await page.locator("#memorial-splash").count() === 0);

await context.close();

const timed = await browser.newContext({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
  userAgent: iphone,
  colorScheme: "light",
});
const timedPage = await timed.newPage();
await timedPage.addInitScript(() => localStorage.setItem("tefila-theme", "light"));
await timedPage.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
check("splash is still up before two seconds", await timedPage.locator("#memorial-splash").isVisible());
await timedPage.screenshot({ path: "/opt/cursor/artifacts/memorial-splash-iphone-light.png" });
await timedPage.waitForTimeout(2600);
check("splash leaves after about two seconds", await timedPage.locator("#memorial-splash").count() === 0);
await timed.close();

const reduce = await browser.newContext({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
  userAgent: iphone,
  reducedMotion: "reduce",
});
const reducePage = await reduce.newPage();
await reducePage.goto(base + "/tefila/arvit.html", { waitUntil: "domcontentloaded" });
const motion = await reducePage.locator("#memorial-splash").evaluate((el) => getComputedStyle(el).transitionDuration);
check("reduced motion has no fade", motion === "0s", motion);
await reducePage.locator("#memorial-splash").click();
await reducePage.waitForTimeout(80);
check("reduced motion dismisses without waiting for a fade", await reducePage.locator("#memorial-splash").count() === 0);
await reduce.close();

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
