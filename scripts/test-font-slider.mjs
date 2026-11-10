import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
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
  userAgent: iphone,
});
const page = await context.newPage();
await page.goto(base + "/tefila/shacharit.html", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.removeItem("tefila-font"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) / 2);
});
await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

const start = await page.evaluate(() => {
  const line = window.innerHeight * 0.3;
  const el = [...document.querySelectorAll("p.t")].find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.height > 8 && rect.top <= line && rect.bottom >= line;
  });
  el.dataset.fontAnchor = "1";
  const header = document.querySelector("header.bar").getBoundingClientRect();
  return { top: el.getBoundingClientRect().top, headerHeight: header.height };
});

async function settle() {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function sample() {
  return page.evaluate(() => {
    const el = document.querySelector("[data-font-anchor]");
    const header = document.querySelector("header.bar").getBoundingClientRect();
    return {
      top: el.getBoundingClientRect().top,
      headerHeight: header.height,
      fs: parseInt(getComputedStyle(document.documentElement).getPropertyValue("--fs"), 10),
      slider: document.getElementById("font-slider").value,
      label: document.getElementById("font-value").textContent,
      stored: localStorage.getItem("tefila-font"),
    };
  });
}

const toggle = page.locator("#font-slider-toggle");
check("slider toggle is labeled", (await toggle.getAttribute("aria-label")) === "גודל טקסט");
const headerBefore = start.headerHeight;
await toggle.click();
check("panel opens under the header", await page.locator("#font-panel").isVisible() && (await page.locator("header.bar").boundingBox()).height === headerBefore);
check("range is labeled", (await page.locator("#font-slider").getAttribute("aria-label")) === "גודל טקסט");

const slider = page.locator("#font-slider");
const box = await slider.boundingBox();
const y = box.y + box.height / 2;
async function drag(fromX, toX) {
  await page.mouse.move(fromX, y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(fromX + (toX - fromX) * (i / steps), y);
    await settle();
  }
  await page.mouse.up();
  await settle();
}

const beforeGrow = await sample();
await drag(box.x + box.width - 14, box.x + 14);
const grown = await sample();
check("drag toward large increases size", grown.fs > beforeGrow.fs && grown.slider === String(grown.fs) && grown.label === String(grown.fs), beforeGrow.fs + "→" + grown.fs);
check("drag toward large keeps the paragraph", Math.abs(grown.top - start.top) <= 8, "drift " + Math.abs(grown.top - start.top).toFixed(1));

await drag(box.x + 14, box.x + box.width - 14);
const shrunk = await sample();
check("drag toward small decreases size", shrunk.fs < grown.fs && shrunk.slider === String(shrunk.fs), grown.fs + "→" + shrunk.fs);
check("drag toward small keeps the paragraph", Math.abs(shrunk.top - start.top) <= 8, "drift " + Math.abs(shrunk.top - start.top).toFixed(1));

await page.locator("#font-inc").click();
await settle();
const stepped = await sample();
check("plus stays in sync with the slider", stepped.fs > shrunk.fs && stepped.slider === String(stepped.fs) && stepped.label === String(stepped.fs) && stepped.stored === String(stepped.fs));
check("plus keeps the paragraph", Math.abs(stepped.top - start.top) <= 8, "drift " + Math.abs(stepped.top - start.top).toFixed(1));

await page.reload({ waitUntil: "domcontentloaded" });
const kept = await page.evaluate(() => parseInt(getComputedStyle(document.documentElement).getPropertyValue("--fs"), 10));
await page.locator("#font-slider-toggle").click();
const reloaded = await page.locator("#font-slider").inputValue();
check("size persists after reload", kept === stepped.fs && reloaded === String(stepped.fs), String(kept));

await page.keyboard.press("Escape");
check("escape closes the panel", await page.locator("#font-panel").isHidden());
await page.locator("#font-slider-toggle").click();
await page.locator("main").click({ position: { x: 30, y: 500 } });
check("outside tap closes the panel", await page.locator("#font-panel").isHidden());

await browser.close();
const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
