import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { SCREENSHOTS_DIR } from './playwright.config';

export type LngLat = readonly [lng: number, lat: number];

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Requests still on their way, per page: the map is at rest when there have been none for a moment. */
const pending = new WeakMap<Page, Set<unknown>>();

function watchRequests(page: Page) {
  if (pending.has(page)) return;
  const open = new Set<unknown>();
  pending.set(page, open);
  page.on('request', (request) => open.add(request));
  page.on('requestfinished', (request) => open.delete(request));
  page.on('requestfailed', (request) => open.delete(request));
}

/** Waits until tiles, data and photos have arrived and the camera and the sheet have stopped. */
export async function settle(page: Page, quietMs = 700) {
  watchRequests(page);
  const open = pending.get(page)!;
  const deadline = Date.now() + 8_000;
  let quietSince = Date.now();
  while (Date.now() < deadline) {
    if (open.size > 0) quietSince = Date.now();
    else if (Date.now() - quietSince >= quietMs) break;
    await pause(100);
  }
  await pause(900);
}

/**
 * Opens the app with the camera at `hash` (`zoom/lat/lng/bearing/pitch`) and waits for the map.
 * 3D is the person's own choice here, so the slow-device watchdog never changes a slide; `lite: 'auto'` leaves it to the app.
 */
export async function openApp(page: Page, { hash = '', path = '/', lite = 'off' }: { hash?: string; path?: string; lite?: 'off' | 'auto' } = {}) {
  watchRequests(page);
  if (lite === 'off') {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('usp-map:lite', 'off');
      } catch {
        // No storage: the app decides.
      }
    });
  }
  await page.goto(`${path}${hash ? `#${hash}` : ''}`);
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByText('Carregando mapa…')).toBeHidden();
  // The map's credits open by themselves and fold at the first touch of the map; here they are folded by their own button.
  const credits = page.locator('.maplibregl-ctrl-attrib.maplibregl-compact-show .maplibregl-ctrl-attrib-button');
  if ((await credits.count()) > 0) await credits.click();
  await settle(page);
}

/** The camera as the address bar has it, to come back to after a tap that moved it. */
export const cameraOf = (page: Page) => page.evaluate(() => window.location.hash.slice(1));

export async function restoreCamera(page: Page, hash: string) {
  await page.evaluate((to) => {
    window.location.hash = to;
  }, hash);
  await settle(page);
}

/** Moves the camera, as a shared link does. The selection and the open panel stay. */
export async function moveCamera(page: Page, [lng, lat]: LngLat, { zoom = 18, bearing = 0, pitch = 0 }: { zoom?: number; bearing?: number; pitch?: number } = {}) {
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, `${zoom}/${lat}/${lng}/${bearing}/${pitch}`);
  await settle(page);
}

/**
 * Taps the map at a place: the camera goes there, looking straight down, and the tap lands on
 * the middle of the part of the map that the sheet leaves free, which is where the camera's centre shows.
 */
export async function tapMapAt(page: Page, position: LngLat, zoom = 19) {
  await moveCamera(page, position, { zoom });
  const map = (await page.locator('.maplibregl-canvas').boundingBox())!;
  const sheet = await page.locator('.sheet').boundingBox().catch(() => null);
  // As the app counts it (ui/sheetSnap.ts): the map never makes room for more than 60% of the screen.
  const cover = sheet ? Math.min(sheet.height, Math.round(map.height * 0.6)) : 0;
  await page.touchscreen.tap(map.x + map.width / 2, map.y + (map.height - cover) / 2);
  await settle(page);
}

/** Types in the search field and picks the result with this name. */
export async function pickFromSearch(page: Page, text: string, label: string | RegExp) {
  const field = page.getByRole('combobox', { name: 'Buscar no campus' });
  await field.click();
  await field.fill(text);
  await page.getByRole('option', { name: label }).first().click();
  await settle(page);
}

/** The open panel, by its title. */
export const sheet = (page: Page, title: string | RegExp) => page.locator('section.sheet').and(page.getByRole('region', { name: title }));

/** Saves what the phone shows as the slide's screenshot. */
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: resolve(SCREENSHOTS_DIR, `${name}.png`) });
}

/** Raises the panel to its tallest rest. */
export async function expandSheet(page: Page) {
  const handle = page.getByRole('button', { name: 'Expandir painel' });
  // From half to full is one step; from collapsed, two.
  for (let step = 0; step < 2 && (await handle.count()) > 0; step++) {
    await handle.click();
    await pause(500);
  }
  await settle(page);
}

/** Scrolls the panel's content so that `selector`'s first match is at its top. */
export async function scrollSheetTo(page: Page, text: string) {
  await page.locator('.sheet-scroll').evaluate((scroller, wanted) => {
    const target = [...scroller.querySelectorAll('h3, h2')].find((heading) => heading.textContent?.trim().startsWith(wanted));
    if (target) scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
  }, text);
  await settle(page);
}
