const { test, expect } = require('@playwright/test');

/**
 * Full happy-path test — set env E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run.
 * Skipped by default so CI/local runs do not require real credentials.
 */
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('Admin signed-in smoke', () => {
  test('sign in and reach overview', async ({ page }) => {
    test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to enable this test');
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in to admin panel/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 25_000 });
    await expect(page.getByText(/network overview|overview|dashboard/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
