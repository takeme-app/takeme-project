import { test, expect } from '@playwright/test';
import { hasAdminE2ECredentials } from './helpers/loginAdmin';

test.describe.configure({ timeout: 120_000 });

test.describe('Início — KPIs', () => {
  test.beforeEach(async () => {
    test.skip(!hasAdminE2ECredentials(), 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD.');
  });

  test('cartões de viagens carregam e testids presentes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible({ timeout: 25_000 });
    const emAndamento = page.getByTestId('home-stat-viagens-em-andamento');
    await expect(emAndamento).toBeVisible({ timeout: 60_000 });
    if (process.env.E2E_REQUIRE_DB_ROWS === '1') {
      await expect(emAndamento).not.toHaveText('—');
    }
  });

  test('sub-aba Encomendas mostra KPIs com testids', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: 'Encomendas' }).click();
    const k = page.getByTestId('home-stat-encomendas-em-andamento');
    await expect(k).toBeVisible({ timeout: 30_000 });
  });
});
