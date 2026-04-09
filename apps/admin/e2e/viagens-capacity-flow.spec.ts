import { test, expect } from '@playwright/test';
import { hasAdminE2ECredentials } from './helpers/loginAdmin';

/**
 * Cenários manuais recomendados (capacidade + cancelamento em cadeia):
 * - Criar viagem com capacidade N; N reservas pending devem esgotar lugares; N+1 deve falhar (erro do DB).
 * - Motorista cancela viagem → reservas pending/paid/confirmed viram cancelled; admin/cliente refletem.
 * - Motorista conclui viagem → lista admin mostra concluída (via scheduled_trips.completed).
 */
test.describe('Viagens — lista e métricas', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(() => {
    test.skip(!hasAdminE2ECredentials(), 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD.');
  });

  test('página /viagens exibe métricas e tabela', async ({ page }) => {
    const res = await page.goto('/viagens');
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Viagens', exact: true }).first()).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByText('Viagens totais')).toBeVisible();
    await expect(page.getByText('Lista de viagens')).toBeVisible();
  });
});
