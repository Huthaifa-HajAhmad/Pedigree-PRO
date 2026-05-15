import { test, expect } from "@playwright/test";

test.describe("Pedigree PRO smoke tests", () => {
  test("dashboard loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });

  test("patients page loads successfully", async ({ page }) => {
    await page.goto("/patients");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Patients")).toBeVisible();
  });

  test("pedigrees page loads successfully", async ({ page }) => {
    await page.goto("/pedigrees");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Pedigrees")).toBeVisible();
  });
});
