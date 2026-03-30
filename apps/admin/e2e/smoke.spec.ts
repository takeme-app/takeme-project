import { test, expect, type Page } from '@playwright/test';
import { hasAdminE2ECredentials } from './helpers/loginAdmin';

test.describe('smoke público', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test('documento /login responde e formulário visível', async ({ page }) => {
    const res = await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByTestId('web-login-screen')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByPlaceholder('Telefone ou email')).toBeVisible();
    await expect(page.getByPlaceholder('Senha de acesso')).toBeVisible();
  });
});

test.describe('smoke autenticado', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async () => {
    test.skip(!hasAdminE2ECredentials(), 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD para rotas protegidas.');
  });

  const routes: { path: string; heading: RegExp | string }[] = [
    { path: '/', heading: 'Início' },
    { path: '/viagens', heading: 'Viagens' },
    { path: '/passageiros', heading: 'Passageiros' },
    { path: '/motoristas', heading: 'Motoristas' },
    { path: '/destinos', heading: 'Destinos' },
    { path: '/encomendas', heading: 'Encomendas' },
    { path: '/preparadores', heading: /Preparador de encomendas/ },
    { path: '/promocoes', heading: 'Promoções' },
    { path: '/pagamentos', heading: 'Pagamentos' },
    { path: '/atendimentos', heading: /Visão geral/ },
    { path: '/configuracoes', heading: 'Configurações' },
  ];

  function mainHeading(page: Page, heading: RegExp | string) {
    if (typeof heading === 'string') {
      // `exact: true` evita "Viagens" noutros títulos; `.first()` quando h1 e h2 repetem o mesmo texto (ex.: Passageiros).
      return page.getByRole('heading', { name: heading, exact: true }).first();
    }
    return page.getByRole('heading', { name: heading });
  }

  for (const { path, heading } of routes) {
    test(`rota ${path} — elemento principal`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.ok()).toBeTruthy();
      await expect(mainHeading(page, heading)).toBeVisible({ timeout: 25_000 });
    });
  }

  test('Início — abre e fecha modal de filtro', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible({ timeout: 25_000 });
    await page.getByTestId('home-open-filter').click();
    const dialog = page.getByRole('dialog', { name: 'Filtro' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Aplicar filtro' })).toBeVisible();
    await dialog.click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeHidden();
  });

  test('Viagens — filtro da tabela (nome) altera número de linhas', async ({ page }) => {
    await page.goto('/viagens');
    await expect(page.getByRole('heading', { name: 'Viagens', exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText('Carregando viagens...')).toBeHidden({ timeout: 60_000 });

    const rows = page.getByTestId('viagem-table-row');
    const initial = await rows.count();

    await page.getByTestId('viagens-open-table-filter').click();
    const dialog = page.getByRole('dialog', { name: 'Filtro da tabela' });
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('Ex: Carlos Silva').fill('__e2e_sem_correspondencia__');
    await dialog.getByRole('button', { name: 'Aplicar filtro' }).click();
    await expect(dialog).toBeHidden();
    await expect(rows).toHaveCount(0);

    await page.getByTestId('viagens-open-table-filter').click();
    const dialog2 = page.getByRole('dialog', { name: 'Filtro da tabela' });
    await dialog2.getByPlaceholder('Ex: Carlos Silva').fill('');
    await dialog2.getByRole('button', { name: 'Aplicar filtro' }).click();
    await expect(rows).toHaveCount(initial);
  });
});
