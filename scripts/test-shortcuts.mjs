import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const desktop = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ipadDesktop = mac;
const prayers = ["shacharit.html", "mincha.html", "arvit.html"];
const startHref = "shortcuts://run-shortcut?name=" + encodeURIComponent("תפילה ON");
const endHref = "shortcuts://run-shortcut?name=" + encodeURIComponent("תפילה OFF");
const startLabel = "הפעל קיצור, אתחיל תפילה";
const endLabel = "הפעל קיצור, סיים תפילה";
const onIcloud = "https://www.icloud.com/shortcuts/8afce28b59cf4693889900fcef0bde29";
const offIcloud = "https://www.icloud.com/shortcuts/fc207386d3f74a829b51ecf87941e40b";
const pending = "קישור ההורדה יתווסף בקרוב";

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});

async function open(ua, extra) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: ua === iphone,
    hasTouch: ua !== desktop,
    userAgent: ua,
  });
  if (extra) await context.addInitScript(extra);
  const page = await context.newPage();
  return { context, page };
}

async function assertDownloads(page, where) {
  const on = page.locator("[data-icloud=on]");
  const off = page.locator("[data-icloud=off]");
  check(where + " on download", await on.isVisible() && (await on.innerText()) === "הוסף לאייפון" && (await on.getAttribute("href")) === onIcloud && (await on.getAttribute("target")) === "_blank" && (await on.getAttribute("rel")) === "noopener" && (await on.getAttribute("aria-disabled")) === null);
  check(where + " off download", await off.isVisible() && (await off.innerText()) === "הוסף לאייפון" && (await off.getAttribute("href")) === offIcloud && (await off.getAttribute("target")) === "_blank" && (await off.getAttribute("rel")) === "noopener");
}

async function noStart(page, where) {
  const starts = await page.locator("[data-shortcut=start], .shortcut-start").count();
  const text = await page.locator("body").innerText();
  check(where + " has no start button", starts === 0 && !text.includes("אתחיל תפילה"));
}

{
  const { context, page } = await open(iphone);
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  const gateRow = page.locator(".shortcut-row");
  const gateLinks = gateRow.locator("a");
  check("iPhone gate shows both buttons", await gateRow.count() === 1 && await gateLinks.count() === 2 && await gateLinks.nth(0).isVisible() && await gateLinks.nth(1).isVisible());
  check("iPhone gate start label", (await gateLinks.nth(0).innerText()) === startLabel && (await gateLinks.nth(0).getAttribute("aria-label")) === startLabel);
  check("iPhone gate end label", (await gateLinks.nth(1).innerText()) === endLabel && (await gateLinks.nth(1).getAttribute("aria-label")) === endLabel);
  check("iPhone gate start href", (await gateLinks.nth(0).getAttribute("href")) === startHref, await gateLinks.nth(0).getAttribute("href"));
  check("iPhone gate end href", (await gateLinks.nth(1).getAttribute("href")) === endHref, await gateLinks.nth(1).getAttribute("href"));
  const startBox = await gateLinks.nth(0).boundingBox();
  const endBox = await gateLinks.nth(1).boundingBox();
  check("gate buttons are at least 48px", startBox && endBox && startBox.height >= 48 && endBox.height >= 48, startBox && String(Math.round(startBox.height)));
  const brachotBox = await page.locator('nav[aria-label="ברכות"]').boundingBox();
  const heading = page.locator("h2.hub-h", { hasText: "קיצורים לאייפון" });
  const guide = page.locator('nav[aria-label="קיצורים לאייפון"] a');
  const headingBox = await heading.boundingBox();
  const guideBox = await guide.boundingBox();
  const rowBox = await gateRow.boundingBox();
  const watchBox = await page.locator("h2.hub-h", { hasText: "שעון" }).boundingBox();
  check("gate shortcuts heading", (await heading.innerText()) === "קיצורים לאייפון" && (await guide.getAttribute("href")) === "shortcuts.html" && (await guide.innerText()) === "קיצורים לאייפון");
  check("gate shortcuts sit between brachot and watch", brachotBox && headingBox && guideBox && rowBox && watchBox && brachotBox.y + brachotBox.height <= headingBox.y && headingBox.y < guideBox.y && guideBox.y + guideBox.height <= rowBox.y && rowBox.y + rowBox.height <= watchBox.y);
  await page.goto(base + "/tefila/shortcuts.html", { waitUntil: "domcontentloaded" });
  check("setup page title", (await page.locator("h1, .kicker").first().innerText()) === "קיצורים לאייפון");
  check("setup page explains the names", (await page.locator("main").innerText()).includes("תפילה ON") && (await page.locator("main").innerText()).includes("מצב המיקוד"));
  check("setup page manual fallback", (await page.locator("main").innerText()).includes("Set Focus") && (await page.locator("main").innerText()).includes("https://idanatwork.github.io/LPs/tefila/"));
  await assertDownloads(page, "iPhone setup");
  const testRow = page.locator(".shortcut-row");
  check("iPhone setup shows the test row", await testRow.isVisible() && (await testRow.locator("[data-shortcut=start]").getAttribute("href")) === startHref && (await testRow.locator("[data-shortcut=end]").getAttribute("href")) === endHref);
  for (const name of prayers) {
    await page.goto(base + "/tefila/" + name, { waitUntil: "domcontentloaded" });
    const rows = page.locator(".shortcut-row");
    const link = rows.locator("a");
    check(name + " has one end button", await rows.count() === 1 && await link.count() === 1 && await link.isVisible());
    check(name + " end label", (await link.innerText()) === endLabel && (await link.getAttribute("aria-label")) === endLabel);
    check(name + " end href", (await link.getAttribute("href")) === endHref, await link.getAttribute("href"));
    const box = await link.boundingBox();
    check(name + " button is at least 48px", box && box.height >= 48, box && String(Math.round(box.height)));
    const sources = page.locator("h2", { hasText: "מקורות" });
    const linkBox = await link.boundingBox();
    const sourcesBox = await sources.boundingBox();
    check(name + " button is before the sources", linkBox && sourcesBox && linkBox.y < sourcesBox.y);
    await noStart(page, name);
  }
  await context.close();
}

{
  const { context, page } = await open(desktop);
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  check("desktop hides the gate buttons", await page.locator(".shortcut-row").isHidden());
  await page.goto(base + "/tefila/index.html?showShortcuts=1", { waitUntil: "domcontentloaded" });
  check("desktop override shows both gate buttons", await page.locator(".shortcut-row a").count() === 2 && await page.locator("[data-shortcut=start]").isVisible());
  check("override keeps the start href", (await page.locator("[data-shortcut=start]").getAttribute("href")) === startHref);
  check("override keeps the gate end href", (await page.locator("[data-shortcut=end]").getAttribute("href")) === endHref);
  await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
  check("desktop hides the end button", await page.locator(".shortcut-row").isHidden());
  await page.goto(base + "/tefila/shacharit.html?showShortcuts=1", { waitUntil: "domcontentloaded" });
  check("desktop override shows the end button", await page.locator(".shortcut-row").isVisible());
  check("override keeps the end href", (await page.locator("[data-shortcut=end]").getAttribute("href")) === endHref);
  await page.goto(base + "/tefila/shortcuts.html", { waitUntil: "domcontentloaded" });
  await assertDownloads(page, "desktop setup");
  check("desktop hides the setup test row", await page.locator(".shortcut-row").isHidden());
  await page.evaluate(() => {
    ICLOUD_LINKS.on = "";
    ICLOUD_LINKS.off = "  ";
    applyIcloudLinks();
  });
  const cleared = page.locator("[data-icloud=on]");
  check("empty download link stays disabled", (await cleared.getAttribute("aria-disabled")) === "true" && (await cleared.innerText()) === pending && (await cleared.getAttribute("href")) === null && (await page.locator("[data-icloud=off]").innerText()) === pending);
  await context.close();
}

{
  const { context, page } = await open(mac);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
  const link = page.locator(".shortcut-row a");
  check("Mac shows the end button", await link.count() === 1 && await link.isVisible());
  check("Mac end label", (await link.innerText()) === endLabel);
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  const gateLinks = page.locator(".shortcut-row a");
  check("Mac shows both gate buttons", await gateLinks.count() === 2 && await gateLinks.nth(0).isVisible() && await gateLinks.nth(1).isVisible());
  await page.goto(base + "/tefila/shortcuts.html", { waitUntil: "domcontentloaded" });
  await assertDownloads(page, "Mac setup");
  check("Mac shows the setup test row", await page.locator(".shortcut-row").isVisible());
  await context.close();
}

{
  const { context, page } = await open(windows);
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  check("Windows hides the gate buttons", await page.locator(".shortcut-row").isHidden());
  await page.goto(base + "/tefila/mincha.html", { waitUntil: "domcontentloaded" });
  check("Windows hides the end button", await page.locator(".shortcut-row").isHidden());
  await page.goto(base + "/tefila/shortcuts.html", { waitUntil: "domcontentloaded" });
  await assertDownloads(page, "Windows setup");
  check("Windows hides the setup test row", await page.locator(".shortcut-row").isHidden());
  await context.close();
}

{
  const { context, page } = await open(ipadDesktop, () => {
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  });
  await page.goto(base + "/tefila/arvit.html", { waitUntil: "domcontentloaded" });
  check("iPad desktop mode shows the end button", await page.locator(".shortcut-row").isVisible());
  await context.close();
}

const creditPages = [
  "/tefila/index.html",
  "/tefila/shacharit.html",
  "/tefila/mincha.html",
  "/tefila/arvit.html",
  "/tefila/zmanim.html",
  "/brachot/asher-yatzar.html",
  "/brachot/borei-nefashot.html",
  "/brachot/meein-shalosh.html",
  "/brachot/birkat-hamazon.html",
  "/tefila/shortcuts.html",
];
const creditText = "נבנה ע\"י טק-מייט | Tech-Mate";

{
  const { context, page } = await open(iphone);
  for (const path of creditPages) {
    await page.goto(base + path, { waitUntil: "domcontentloaded" });
    const credit = page.locator("main .site-credit");
    const link = credit.locator("a");
    check(path + " credit text", (await credit.innerText()) === creditText, await credit.innerText());
    check(path + " credit link", (await link.getAttribute("href")) === "https://brand.page/Tech-Mate" && (await link.getAttribute("target")) === "_blank" && (await link.getAttribute("rel")) === "noopener");
    check(path + " credit is the last line", await page.locator("main > :last-child").evaluate((el) => el.classList.contains("site-credit")));
    const style = await credit.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { align: cs.textAlign, size: cs.fontSize, color: cs.color };
    });
    check(path + " credit is small and centered", style.align === "center" && style.size === "13px", JSON.stringify(style));
  }
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const dark = await page.locator(".site-credit").evaluate((el) => getComputedStyle(el).color);
  check("gate credit uses the dark muted color", dark === "rgb(196, 184, 168)", dark);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  const light = await page.locator(".site-credit").evaluate((el) => getComputedStyle(el).color);
  check("gate credit uses the light muted color", light === "rgb(92, 83, 72)", light);
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
    userAgent: iphone,
  });
  const page = await context.newPage();
  await page.goto(base + "/brachot/asher-yatzar.html", { waitUntil: "domcontentloaded" });
  const color = await page.locator(".site-credit").evaluate((el) => getComputedStyle(el).color);
  check("asher yatzar credit follows dark mode", color === "rgb(165, 157, 144)", color);
  await context.close();
}

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
