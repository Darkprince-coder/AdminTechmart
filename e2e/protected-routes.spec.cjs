const { test, expect } = require('@playwright/test');

test.describe('Auth gate', () => {
  test('unauthenticated user is redirected from /sales to /login', async ({ page }) => {
    await page.goto('/sales');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user is redirected from / to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});
