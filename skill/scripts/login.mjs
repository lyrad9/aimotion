// Open a visible browser, let the user sign in by hand, then save the session
// (cookies + localStorage) so capture.mjs can shoot pages behind a login.
// usage: node login.mjs <url> <state.json> [--until <urlSubstring>] [--channel chrome|msedge]
//   waits until the page URL contains --until (default "/dashboard"), then saves.
// The state file holds live credentials: keep it out of git and delete it when done.
import { chromium } from 'playwright';

const [, , url, out, ...rest] = process.argv;
if (!url || !out) { console.error('usage: node login.mjs <url> <state.json> [--until /dashboard]'); process.exit(1); }
const i = rest.indexOf('--until');
const until = i >= 0 ? rest[i + 1] : '/dashboard';

// headed mode needs a full browser; only the headless shell is installed, so use a system one
// (--channel chrome | msedge). It runs on a throwaway profile, never the user's own.
const c = rest.indexOf('--channel');
const browser = await chromium.launch({ headless: false, channel: c >= 0 ? rest[c + 1] : 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(url);
console.log(`Connecte-toi dans la fenêtre. Sauvegarde dès que l'URL contient "${until}" (10 min max).`);
// watch EVERY tab (the user often pastes the magic link in a new one) and match the
// path only (a login URL often carries the target in its query: ?redirect=/dashboard)
const onTarget = () => ctx.pages().some((p) => { try { return new URL(p.url()).pathname.includes(until); } catch { return false; } });
const deadline = Date.now() + 600000;
while (!onTarget()) {
  if (Date.now() > deadline || !browser.isConnected()) { console.error('Fenêtre fermée ou délai dépassé.'); process.exit(1); }
  await new Promise((r) => setTimeout(r, 1000));
}
await page.waitForTimeout(3000); // let the auth client persist its tokens
await ctx.storageState({ path: out });
await browser.close();
console.log('session ->', out);
