import { chromium, webkit } from "playwright-core";
import { mkdirSync } from "fs";

const base = process.env.BASE_URL || "http://127.0.0.1:8765";
mkdirSync("/opt/cursor/artifacts", { recursive: true });
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? "OK " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}
const iphone = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};
const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const crios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";
const edgeIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/126.0.2592.56 Version/17.0 Mobile/15E148 Safari/604.1";
const whatsapp = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.11.76";
const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36";

async function guideText(page) {
  await page.locator("#install-go").click();
  return (await page.locator("#install-guide").innerText()).replace(/\s+/g, " ");
}

const kit = await webkit.launch();

const safariContext = await kit.newContext({ ...iphone, userAgent: safari });
const safariPage = await safariContext.newPage();
await safariPage.addInitScript(() => sessionStorage.setItem("tefila-splash", "1"));
await safariPage.goto(base + "/tefila/", { waitUntil: "domcontentloaded" });
check("safari banner is shown", await safariPage.locator("#install-banner").isVisible());
const safariGuide = await guideText(safariPage);
check("safari guide points to the bottom share button", safariGuide.includes("בתחתית המסך") && safariGuide.includes("הוסף למסך הבית") && !safariGuide.includes("פתיחה בדפדפן"), safariGuide);
check("safari guide has no English", !/[A-Za-z]/.test(safariGuide));
await safariPage.screenshot({ path: "/opt/cursor/artifacts/install-ios-safari.png" });
await safariPage.locator("#install-close").click();
await safariPage.locator("#install-hub").scrollIntoViewIfNeeded();
await safariPage.locator("#install-hub").screenshot({ path: "/opt/cursor/artifacts/install-menu.png" });
await safariContext.close();

const chromeContext = await kit.newContext({ ...iphone, userAgent: crios });
const chromePage = await chromeContext.newPage();
await chromePage.addInitScript(() => sessionStorage.setItem("tefila-splash", "1"));
await chromePage.goto(base + "/tefila/", { waitUntil: "domcontentloaded" });
const chromeGuide = await guideText(chromePage);
check("chrome on ios uses the address-bar share guide", chromeGuide.includes("למעלה בצד ימין") && chromeGuide.includes("הוסף למסך הבית") && !chromeGuide.includes("בתחתית") && !chromeGuide.includes("פתיחה בדפדפן"), chromeGuide);
await chromePage.screenshot({ path: "/opt/cursor/artifacts/install-ios-chrome.png" });
await chromeContext.close();

const edgeContext = await kit.newContext({ ...iphone, userAgent: edgeIos });
const edgePage = await edgeContext.newPage();
await edgePage.addInitScript(() => sessionStorage.setItem("tefila-splash", "1"));
await edgePage.goto(base + "/tefila/", { waitUntil: "domcontentloaded" });
const edgeGuide = await guideText(edgePage);
check("edge on ios uses the share-menu guide", edgeGuide.includes("כפתור השיתוף") && edgeGuide.includes("הוסף למסך הבית") && !edgeGuide.includes("בתחתית") && !edgeGuide.includes("למעלה בצד ימין"), edgeGuide);
await edgeContext.close();

const appContext = await kit.newContext({ ...iphone, userAgent: whatsapp });
const appPage = await appContext.newPage();
await appPage.addInitScript(() => sessionStorage.setItem("tefila-splash", "1"));
await appPage.goto(base + "/tefila/", { waitUntil: "domcontentloaded" });
const appGuide = await guideText(appPage);
check("in-app browser explains opening the link", appGuide.includes("שלוש הנקודות") && appGuide.includes("פתיחה בדפדפן") && await appPage.locator("#install-copy").isVisible(), appGuide);
await appContext.close();

const alone = await kit.newContext({ ...iphone, userAgent: safari });
const alonePage = await alone.newPage();
await alonePage.addInitScript(() => {
  sessionStorage.setItem("tefila-splash", "1");
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (query) => String(query).includes("display-mode")
    ? { matches: true, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
    : orig(query);
  Object.defineProperty(navigator, "standalone", { get: () => true });
});
await alonePage.goto(base + "/tefila/", { waitUntil: "domcontentloaded" });
check("standalone hides the install prompt", await alonePage.locator("#install-banner").isHidden() && await alonePage.locator("#install-hub").isHidden());
await alone.close();
await kit.close();

const chrome = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-gpu"] });
const androidContext = await chrome.newContext({ ...iphone, userAgent: android });
const androidPage = await androidContext.newPage();
await androidPage.addInitScript(() => sessionStorage.setItem("tefila-splash", "1"));
await androidPage.goto(base + "/tefila/", { waitUntil: "domcontentloaded" });
check("android banner waits for the install event", await androidPage.locator("#install-banner").isHidden());
await androidPage.evaluate(() => {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = () => Promise.resolve();
  event.userChoice = Promise.resolve({ outcome: "dismissed" });
  window.dispatchEvent(event);
});
check("android shows the install button", await androidPage.locator("#install-banner").isVisible() && (await androidPage.locator("#install-go").innerText()).trim() === "התקן כאפליקציה");
await androidPage.screenshot({ path: "/opt/cursor/artifacts/install-android-banner.png" });
await androidPage.locator("#install-later").click();
check("not now hides the banner and keeps the menu", await androidPage.locator("#install-banner").isHidden() && await androidPage.locator("#install-hub").isVisible());
await chrome.close();

const failed = checks.filter((item) => !item.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
