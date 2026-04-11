const { test, expect } = require('@playwright/test');

test.describe('Login (smoke)', () => {
  test('login page shows welcome and form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });
});
