import { expect, type Page } from '@playwright/test';

export function hasAdminE2ECredentials(): boolean {
  return !!(process.env.E2E_ADMIN_EMAIL?.trim() && process.env.E2E_ADMIN_PASSWORD?.trim());
}

const LOGIN_POST_CLICK_MS = 90_000;

/**
 * Login explícito (legado / depuração). Os specs principais usam `storageState`
 * gerado em `e2e/auth.setup.ts` após o mesmo fluxo.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Telefone ou email').fill(process.env.E2E_ADMIN_EMAIL!.trim());
  await page.getByPlaceholder('Senha de acesso').fill(process.env.E2E_ADMIN_PASSWORD!.trim());
  await page.getByRole('button', { name: 'Continuar' }).click();
  // Preferir o heading do dashboard à URL: em SPAs o router pode atualizar tarde ou o `load` atrasar.
  await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible({ timeout: LOGIN_POST_CLICK_MS });
}
