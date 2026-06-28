import { chromium } from "playwright-core";
const SHOTS = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/f22ddbf1-cd11-460d-aff5-d2bde9a43faf/scratchpad/shots";
const BASE = "https://rotaganyan.com";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(`${BASE}/giris`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "admin@rotaganyan.com");
  await page.fill('input[name="password"]', "Admin123!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/giris"), { timeout: 10000 });

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${SHOTS}/admin-mobile-top.png` });

  const menuBtn = page.locator("header button").last();
  console.log("menu btn count:", await menuBtn.count());
  await menuBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/admin-mobile-drawer.png` });

  const linksText = await page.locator("nav a, nav button").allInnerTexts();
  console.log("drawer links:", linksText);

  // click a link, verify drawer closes and navigation happens
  await page.locator("text=Kullanıcılar").click();
  await page.waitForLoadState("networkidle");
  console.log("url after click:", page.url());
  await page.screenshot({ path: `${SHOTS}/admin-mobile-after-nav.png` });

  await browser.close();
}
main().catch(e => console.log("ERR", e));
