import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { cameraOf, expandSheet, type LngLat, moveCamera, openApp, pickFromSearch, restoreCamera, scrollSheetTo, settle, sheet, shot, tapMapAt } from './helpers';
import { ROOT, WORKER_PORT } from './playwright.config';
import { BLOCKED } from './seed';

/**
 * One test per slide of docs/journey/journey.md, in its order. Each brings the app to the
 * slide's "Estado a capturar" by the same taps a person would make, and saves the screenshot.
 */

const ELEVATOR: LngLat = [-46.738356, -23.566895];
/** The library, on level 1 of the FAU building. */
const ROOM: LngLat = [-46.73011, -23.560202];
/** A spot on a sidewalk, away from any building. */
const SIDEWALK: LngLat = [-46.727, -23.5604];
const VISUAL_ROUTE = 'Acesso Biênio via Estacionamento';
/** The two ends of the route slides: the walking route between them has stairs. */
const ROUTE_FROM = 'Reitoria';
const ROUTE_TO = 'FFLCH - História e Geografia';

const reviewPassword = () => /^REVIEW_TOKEN=(.+)$/m.exec(readFileSync(resolve(ROOT, 'worker/.dev.vars'), 'utf8'))?.[1]?.trim() ?? '';

const openBuilding = async (page: Page) => {
  await openApp(page);
  await pickFromSearch(page, 'Vilanova Artigas', /Edifício Vilanova Artigas/);
  await expect(sheet(page, 'Edifício Vilanova Artigas')).toBeVisible();
};

const openInstitute = async (page: Page) => {
  await openApp(page);
  await pickFromSearch(page, 'Escola Politécnica', /^Escola Politécnica\s*EP · Unidade/);
  await expect(sheet(page, 'Escola Politécnica')).toBeVisible();
};

const openVisualRoute = async (page: Page) => {
  await openInstitute(page);
  await page.getByRole('button', { name: new RegExp(VISUAL_ROUTE) }).click();
  await expect(sheet(page, new RegExp(VISUAL_ROUTE))).toBeVisible();
  await expandSheet(page);
};

const openStop = async (page: Page) => {
  await openApp(page);
  await pickFromSearch(page, 'Educação', /^Educação\s*Ponto de ônibus/);
  await expect(page.getByRole('heading', { name: 'Próximos ônibus' })).toBeVisible();
  await settle(page);
};

/** Chooses one end of the route by typing its name. */
const chooseEnd = async (page: Page, end: 'Origem da rota' | 'Destino da rota', name: string) => {
  const field = page.getByRole('combobox', { name: end });
  await field.click();
  await field.fill(name);
  await page.getByRole('listbox', { name: 'Sugestões' }).getByRole('option', { name: new RegExp(`^${name}`) }).first().click();
};

const openRoute = async (page: Page, profile: 'A pé' | 'Sem degraus') => {
  await openApp(page);
  await page.getByRole('button', { name: 'Traçar rota' }).click();
  await chooseEnd(page, 'Destino da rota', ROUTE_TO);
  await chooseEnd(page, 'Origem da rota', ROUTE_FROM);
  if (profile === 'Sem degraus') await page.getByRole('tab', { name: 'Sem degraus' }).click();
  await expect(page.getByRole('heading', { name: 'Passo a passo' })).toBeVisible({ timeout: 45_000 });
  await settle(page);
};

/** The report flow up to its last step, about a blocked passage on a sidewalk. */
const writeReport = async (page: Page) => {
  await page.getByRole('button', { name: 'Relatar um problema' }).click();
  await expect(sheet(page, 'Onde está o problema?')).toBeVisible();
  await tapMapAt(page, SIDEWALK);
  await page.getByRole('button', { name: /^Passagem bloqueada/ }).click();
  await page.getByRole('button', { name: 'Não', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar observação' }).click();
  await page.getByLabel('Observação (opcional)').fill('Tapume de obra fecha a calçada.');
};

const openReview = async (page: Page) => {
  await page.goto('/?revisar');
  await page.getByLabel('Senha de revisão').fill(reviewPassword());
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: /^Pendentes/ })).toBeVisible();
};

/** Refuses the reports the slides themselves sent, so the review slides always show the same queue. */
async function refuseSentReports(page: Page) {
  const api = `http://localhost:${WORKER_PORT}`;
  const headers = { Authorization: `Bearer ${reviewPassword()}` };
  const lists = (await (await page.request.get(`${api}/review/reports`, { headers })).json()) as { pending: { id: string }[] };
  for (const { id } of lists.pending) {
    if (!id.startsWith('j-')) await page.request.post(`${api}/review/reports/${id}`, { headers, data: { status: 'refused' } });
  }
}

// A. Explorar o campus

test('s01 mapa inicial', async ({ page }) => {
  await openApp(page);
  await shot(page, 's01-mapa');
});

test('s02 busca', async ({ page }) => {
  await openApp(page);
  const field = page.getByRole('combobox', { name: 'Buscar no campus' });
  await field.click();
  // A search whose results fit without scrolling: headless Chrome leaves a blank patch under a list that scrolls over the map.
  await field.fill('brasiliana');
  await expect(page.getByText('Fora do campus')).toBeVisible();
  await settle(page);
  await shot(page, 's02-busca');
});

test('s03 painel do prédio', async ({ page }) => {
  await openBuilding(page);
  await shot(page, 's03-predio');
});

test('s04 painel da unidade', async ({ page }) => {
  await openInstitute(page);
  await expect(page.getByRole('heading', { name: 'Rotas visuais' })).toBeVisible();
  await expandSheet(page);
  await scrollSheetTo(page, 'Rotas visuais');
  await shot(page, 's04-unidade');
});

test('s05 painel de um local', async ({ page }) => {
  await openApp(page);
  await pickFromSearch(page, 'Lanchonete do IME', /^Lanchonete do IME/);
  await expect(sheet(page, 'Lanchonete do IME')).toBeVisible();
  await shot(page, 's05-local');
});

test('s06 menu de camadas', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Camadas do mapa' }).click();
  await expect(page.getByRole('region', { name: 'Camadas' })).toBeVisible();
  await shot(page, 's06-camadas');
});

// B. Visão de acessibilidade

test('s07 visão de acessibilidade', async ({ page }) => {
  await openApp(page, { hash: '17/-23.5632/-46.7252/0/45' });
  await page.getByRole('button', { name: 'Acessibilidade' }).click();
  await expect(page.getByRole('region', { name: 'Legenda de acessibilidade' })).toBeVisible();
  await settle(page);
  await shot(page, 's07-acessibilidade');
});

test('s08 ponto de acessibilidade', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Acessibilidade' }).click();
  await tapMapAt(page, ELEVATOR);
  await expect(sheet(page, 'Elevador')).toBeVisible();
  await moveCamera(page, ELEVATOR, { zoom: 18, pitch: 45 });
  await shot(page, 's08-ponto-acessibilidade');
});

// C. Dentro de um prédio

const openPlan = async (page: Page) => {
  await openBuilding(page);
  await page.getByRole('button', { name: 'Ver planta interna' }).click();
  await page.getByRole('group', { name: 'Andares' }).getByRole('button', { name: /^Nível 1:/ }).click();
  await settle(page);
};

test('s09 planta interna', async ({ page }) => {
  await openPlan(page);
  await shot(page, 's09-planta-interna');
});

test('s10 painel de uma sala', async ({ page }) => {
  await openPlan(page);
  const plan = await cameraOf(page);
  await tapMapAt(page, ROOM, 19.5);
  await expect(sheet(page, 'Biblioteca')).toBeVisible();
  await restoreCamera(page, plan);
  await shot(page, 's10-sala');
});

// D. Rotas visuais

test('s11 rota visual', async ({ page }) => {
  await openVisualRoute(page);
  await shot(page, 's11-rota-visual');
});

test('s12 foto de um passo', async ({ page }) => {
  await openVisualRoute(page);
  await page.getByRole('button', { name: 'Ampliar a foto do passo 2' }).click();
  await expect(page.getByRole('dialog', { name: 'Foto do passo 2' })).toBeVisible();
  await settle(page);
  await shot(page, 's12-foto-passo');
});

// E. Ônibus

test('s13 painel do ponto de ônibus', async ({ page }) => {
  await openStop(page);
  await shot(page, 's13-ponto');
});

test('s14 painel do ônibus', async ({ page }) => {
  await openStop(page);
  const followable = page.locator('.arrival-follow');
  // Only while buses of the campus lines are running.
  test.skip((await followable.count()) === 0, 'No bus on the map is heading to this stop right now.');
  // A bus that is still on its way here, when there is one: a loop line also lists the bus that has just left.
  for (let index = 0; index < (await followable.count()); index++) {
    await followable.nth(index).click();
    await expect(page.getByRole('heading', { name: 'Pontos da linha' })).toBeVisible();
    if (!(await page.locator('.timeline-stop.target').getByText('Passou').isVisible())) break;
    if (index + 1 < (await followable.count())) await page.getByRole('button', { name: 'Todas as chegadas' }).click();
  }
  await settle(page);
  await shot(page, 's14-onibus');
});

// F. Rotas

test('s15 painel de rota vazio', async ({ page }) => {
  await openBuilding(page);
  await page.getByRole('button', { name: 'Rota até aqui' }).click();
  await expect(sheet(page, 'Rota')).toBeVisible();
  await settle(page);
  await shot(page, 's15-rota-vazia');
});

test('s16 escolha de uma ponta da rota', async ({ page }) => {
  await openBuilding(page);
  await page.getByRole('button', { name: 'Rota até aqui' }).click();
  await page.getByRole('combobox', { name: 'Origem da rota' }).fill('reitoria');
  await expect(page.getByRole('listbox', { name: 'Sugestões' }).getByRole('option', { name: /^Reitoria/ }).first()).toBeVisible();
  await settle(page);
  await shot(page, 's16-rota-ponta');
});

test('s17 rota a pé', async ({ page }) => {
  await openRoute(page, 'A pé');
  await expect(page.getByText('Atenção: esta rota passa por escadas.')).toBeVisible();
  await shot(page, 's17-rota-a-pe');
});

test('s18 rota sem degraus', async ({ page }) => {
  await openRoute(page, 'Sem degraus');
  await expect(page.getByText(/^Rota desviando de 1 bloqueio relatado/)).toBeVisible();
  await shot(page, 's18-rota-sem-degraus');
});

// G. Relatar um problema

test('s19 relato: onde', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Relatar um problema' }).click();
  await expect(sheet(page, 'Onde está o problema?')).toBeVisible();
  await settle(page);
  await shot(page, 's19-relato-onde');
});

test('s20 relato: o que', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Relatar um problema' }).click();
  await tapMapAt(page, SIDEWALK);
  await expect(sheet(page, 'O que há de errado?')).toBeVisible();
  await shot(page, 's20-relato-o-que');
});

test('s21 relato: envio', async ({ page }) => {
  await openApp(page);
  await writeReport(page);
  await expandSheet(page);
  await shot(page, 's21-relato-envio');
});

test('s22 seu relato', async ({ page }) => {
  await openApp(page);
  await writeReport(page);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Relato enviado. Ele aparece no mapa depois de revisado.')).toBeVisible();
  await tapMapAt(page, SIDEWALK);
  await expect(page.getByText('Aguardando revisão. Por enquanto só aparece neste aparelho.')).toBeVisible();
  await shot(page, 's22-seu-relato');
  await refuseSentReports(page);
});

const openPublishedReport = async (page: Page) => {
  await openApp(page);
  await tapMapAt(page, BLOCKED.position);
  await expect(page.getByRole('button', { name: 'Continua assim' })).toBeVisible();
  // Back far enough to see where on the campus it is.
  await moveCamera(page, BLOCKED.position, { zoom: 17.2, pitch: 45 });
};

test('s23 relato publicado', async ({ page }) => {
  await openPublishedReport(page);
  await expandSheet(page);
  await shot(page, 's23-relato-publicado');
});

test('s24 o que mudou', async ({ page }) => {
  await openPublishedReport(page);
  await page.getByRole('button', { name: 'Mudou' }).click();
  await page.getByRole('button', { name: 'Foi resolvido' }).click();
  await page.getByLabel('Observação (opcional)').fill('O tapume foi retirado.');
  await expandSheet(page);
  await shot(page, 's24-o-que-mudou');
});

// H. Revisão de relatos

test('s25 entrada do revisor', async ({ page }) => {
  await page.goto('/?revisar');
  await expect(page.getByLabel('Senha de revisão')).toBeVisible();
  await shot(page, 's25-revisao-entrada');
});

test('s26 relatos pendentes', async ({ page }) => {
  await openReview(page);
  await shot(page, 's26-revisao-pendentes');
});

test('s27 confirmação da publicação', async ({ page }) => {
  await openReview(page);
  const card = page.getByRole('listitem').filter({ hasText: 'Guia alta na travessia' });
  await card.getByRole('button', { name: 'Publicar' }).click();
  const until = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await card.getByLabel('Vale até').fill(until);
  await card.getByLabel('Nota pública').fill('Guia alta na travessia em frente ao ponto.');
  await card.scrollIntoViewIfNeeded();
  await shot(page, 's27-revisao-publicar');
});

test('s28 mudanças relatadas e publicados', async ({ page }) => {
  await openReview(page);
  await page.getByRole('heading', { name: /^Mudanças relatadas/ }).evaluate((heading) => window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 16));
  await shot(page, 's28-revisao-publicados');
});

// I. Quando algo dá errado

test('s29 sem conexão', async ({ page, context }) => {
  await openApp(page);
  // The place is looked at before the connection goes, so its tiles are there.
  await moveCamera(page, SIDEWALK, { zoom: 19 });
  await context.setOffline(true);
  await expect(page.getByText('Sem conexão · ônibus ao vivo indisponíveis')).toBeVisible();
  await writeReport(page);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Sem conexão. O relato ficou guardado e será enviado quando a internet voltar.')).toBeVisible();
  await tapMapAt(page, SIDEWALK);
  await expect(page.getByText('Ainda não enviado: será enviado quando a internet voltar.')).toBeVisible();
  await shot(page, 's29-sem-conexao');
});

test('s30 modo leve', async ({ page }) => {
  await openApp(page, { lite: 'auto' });
  const toast = page.getByText('Modo leve ativado para o mapa ficar mais fluido.');
  const map = (await page.locator('.maplibregl-canvas').boundingBox())!;
  const dragAround = async () => {
    await page.mouse.move(map.x + 200, map.y + 500);
    await page.mouse.down();
    for (let step = 0; step < 120 && !(await toast.isVisible()); step++) {
      await page.mouse.move(map.x + 200 + 60 * Math.sin(step / 6), map.y + 500 + 60 * Math.cos(step / 6));
      await page.waitForTimeout(50);
    }
    await page.mouse.up();
  };
  await dragAround();
  if (!(await toast.isVisible())) {
    // A fast computer draws 3D smoothly: it is slowed down to what a weak phone does.
    const devtools = await page.context().newCDPSession(page);
    await devtools.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await dragAround();
    await devtools.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  await expect(toast).toBeVisible();
  await settle(page);
  await shot(page, 's30-modo-leve');
});
