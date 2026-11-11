import { chromium } from "playwright-core";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});

const phone = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: iphone });
const page = await phone.newPage();
await page.goto(base + "/tefila/shacharit.html", { waitUntil: "networkidle" });
await page.evaluate(() => document.querySelector('#toc a[href="#s9"]').click());
await page.waitForFunction(() => {
  const header = document.querySelector("header.bar").getBoundingClientRect().bottom;
  const title = document.getElementById("s9").getBoundingClientRect().top;
  return title >= header - 2 && title < header + 28;
}, null, { timeout: 12000 });
const place = await page.evaluate(() => {
  const header = document.querySelector("header.bar").getBoundingClientRect().bottom;
  const title = document.getElementById("s9").getBoundingClientRect().top;
  return { header, title };
});
check("toc title clears the sticky header", place.title >= place.header - 2 && place.title < place.header + 28, JSON.stringify(place));

const hallel = await page.locator("#s11").innerText();
check("rosh chodesh hallel is in the page", hallel.includes("הַלְלוּ") && !hallel.includes("אינם כלולים"));
check("half hallel hides the skipped paragraph until a full-hallel day", !(await page.locator("#s11 details[data-open='hallel-full']").first().evaluate((el) => el.open)));
const musaf = await page.locator("#s15b").innerText();
check("weekday rosh chodesh musaf is open", (await page.locator("#s15b").evaluate((el) => el.open)) && musaf.includes("רָאשֵׁי חֳדָשִׁים"));
check("musaf includes kedusha for a minyan", (await page.locator("#s15b").evaluate((el) => el.textContent)).includes("קדושה"));
const barchi = await page.locator("#s25b");
check("barchi nafshi follows the song of the day", (await barchi.evaluate((el) => el.open)) && (await barchi.innerText()).includes("בָּרְכִי נַפְשִׁי"));

await page.addInitScript(() => localStorage.setItem("tefila-theme", "light"));
await page.emulateMedia({ colorScheme: "dark" });
await page.goto(base + "/brachot/asher-yatzar.html", { waitUntil: "networkidle" });
const asher = await page.evaluate(() => ({
  bg: getComputedStyle(document.body).backgroundColor,
  boot: !!document.querySelector('script[src*="boot.js"]'),
  theme: !!document.getElementById("theme-toggle"),
  scroll: !!document.getElementById("scroll-toggle"),
  size: !!document.getElementById("font-slider-toggle"),
}));
check("asher yatzar follows the saved light theme", asher.bg === "rgb(253, 251, 246)", asher.bg);
check("asher yatzar has the shared header controls", asher.boot && asher.theme && asher.scroll && asher.size);

const requests = [];
page.on("request", (req) => { if (req.url().includes("version.json")) requests.push(req.url()); });
await page.goto(base + "/tefila/index.html", { waitUntil: "networkidle" });
check("home page checks the published version", requests.some((url) => url.includes("version.json")));

await browser.close();

const androidBrowser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-gpu"],
});
const androidContext = await androidBrowser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: android });
const androidPage = await androidContext.newPage();
await androidPage.goto(base + "/tefila/index.html", { waitUntil: "domcontentloaded" });
check("focus section is hidden away from Apple devices", await androidPage.locator("#focus-hub").isHidden());
await androidBrowser.close();

const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
