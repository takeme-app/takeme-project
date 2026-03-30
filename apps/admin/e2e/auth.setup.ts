import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '.auth', 'admin.json');

/**
 * Corre depois do `webServer` estar no ar. Grava sessão admin ou estado vazio.
 */
setup('sessão admin', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD?.trim();
  if (!email || !password) {
    await page.goto('about:blank');
    await page.context().storageState({ path: authFile });
    return;
  }
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Telefone ou email').fill(email);
  await page.getByPlaceholder('Senha de acesso').fill(password);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible({ timeout: 90_000 });
  await page.context().storageState({ path: authFile });
});
