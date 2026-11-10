import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const desktop = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const ipadDesktop = mac;
const startHref = "shortcuts://run-shortcut?name=" + encodeURIComponent("פתח תפילה");
const endHref = "shortcuts://run-shortcut?name=" + encodeURIComponent("סיים תפילה");
const startLabel = "הפעל קיצור, אתחיל תפילה";
const endLabel = "הפעל קיצור, סיים תפילה";

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

{
  const { context, page } = await open(iphone);
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  const links = page.locator(".shortcut-row a");
  check("iPhone gate shows two buttons", await links.count() === 2 && await links.nth(0).isVisible() && await links.nth(1).isVisible());
  check("iPhone gate start label", (await links.nth(0).innerText()) === startLabel && (await links.nth(0).getAttribute("aria-label")) === startLabel);
  check("iPhone gate end label", (await links.nth(1).innerText()) === endLabel && (await links.nth(1).getAttribute("aria-label")) === endLabel);
  check("iPhone gate start href", (await links.nth(0).getAttribute("href")) === startHref, await links.nth(0).getAttribute("href"));
  check("iPhone gate end href", (await links.nth(1).getAttribute("href")) === endHref, await links.nth(1).getAttribute("href"));
  const box = await links.nth(0).boundingBox();
  check("start button is at least 48px", box && box.height >= 48, box && String(Math.round(box.height)));
  await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
  const rows = page.locator(".shortcut-row");
  check("shacharit has start and end", await rows.count() === 2);
  check("shacharit start href", (await rows.nth(0).locator("a").getAttribute("href")) === startHref);
  check("shacharit end href", (await rows.nth(1).locator("a").getAttribute("href")) === endHref);
  for (const name of ["mincha.html", "arvit.html"]) {
    await page.goto(base + "/tefila/" + name, { waitUntil: "domcontentloaded" });
    const pageRows = page.locator(".shortcut-row");
    check(name + " start and end hrefs", await pageRows.count() === 2 && (await pageRows.nth(0).locator("a").getAttribute("href")) === startHref && (await pageRows.nth(1).locator("a").getAttribute("href")) === endHref);
  }
  await context.close();
}

{
  const { context, page } = await open(desktop);
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  check("desktop hides the gate buttons", await page.locator(".shortcut-row").isHidden());
  await page.goto(base + "/tefila/index.html?showShortcuts=1", { waitUntil: "domcontentloaded" });
  check("desktop override shows the buttons", await page.locator(".shortcut-row").isVisible());
  check("override keeps the start href", (await page.locator("[data-shortcut=start]").getAttribute("href")) === startHref);
  await context.close();
}

{
  const { context, page } = await open(mac);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  const links = page.locator(".shortcut-row a");
  check("Mac shows the gate buttons", await links.count() === 2 && await links.nth(0).isVisible() && await links.nth(1).isVisible());
  check("Mac start label", (await links.nth(0).innerText()) === startLabel);
  check("Mac end label", (await links.nth(1).innerText()) === endLabel);
  await context.close();
}

{
  const { context, page } = await open(windows);
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  check("Windows hides the gate buttons", await page.locator(".shortcut-row").isHidden());
  await context.close();
}

{
  const { context, page } = await open(ipadDesktop, () => {
    Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
  });
  await page.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
  check("iPad desktop mode shows the buttons", await page.locator(".shortcut-row").isVisible());
  await context.close();
}

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
