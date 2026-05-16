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

    await expect(page.getByTestId("nav-patients")).toBeVisible();
    await expect(page.getByText("Patients")).toBeVisible();
  });

  test("pedigrees page loads successfully", async ({ page }) => {
    await page.goto("/pedigrees");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("nav-pedigrees")).toBeVisible();
    await expect(page.getByText("Pedigrees")).toBeVisible();
  });

  test("profiles page loads successfully", async ({ page }) => {
    await page.goto("/profiles");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("button-new-profile")).toBeVisible();
  });

  test("navigation sidebar works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("nav-pedigrees").click();
    await expect(page.getByText("Pedigrees")).toBeVisible();

    await page.getByTestId("nav-patients").click();
    await expect(page.getByText("Patients")).toBeVisible();

    await page.getByTestId("nav-dashboard").click();
    await expect(page.getByText("Dashboard")).toBeVisible();
  });

  test("theme picker toggles theme options", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const themePicker = page.getByLabel("Change color theme");
    await expect(themePicker).toBeVisible();
    await themePicker.click();

    // Verify theme options are visible
    await expect(page.getByText("Obsidian")).toBeVisible();
    await expect(page.getByText("Clinical White")).toBeVisible();
    await expect(page.getByText("Midnight")).toBeVisible();
    await expect(page.getByText("Amber")).toBeVisible();
  });

  test("create patient flow", async ({ page }) => {
    await page.goto("/patients");
    await page.waitForLoadState("networkidle");

    // Open create patient dialog
    await page.getByTestId("button-create-patient").click();

    // Fill in patient details
    await page.getByTestId("input-firstName").fill("John");
    await page.getByTestId("input-lastName").fill("Doe");
    await page.getByTestId("input-dob").fill("1980-01-15");

    // Submit
    await page.getByRole("button", { name: /save|create/i }).first().click();
    await page.waitForTimeout(500);

    // Verify patient appears in list
    await expect(page.getByText("Doe")).toBeVisible();
  });

  test("create pedigree flow", async ({ page }) => {
    await page.goto("/pedigrees");
    await page.waitForLoadState("networkidle");

    // Open create pedigree dialog
    await page.getByTestId("button-new-pedigree").click();

    // Fill in pedigree details
    await page.getByTestId("input-title").fill("Test Family Pedigree");

    // Submit
    await page.getByRole("button", { name: /save|create/i }).first().click();
    await page.waitForTimeout(500);

    // Verify pedigree appears in list
    await expect(page.getByText("Test Family Pedigree")).toBeVisible();
  });

  test("404 page shows on unknown route", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/nonexistent-route");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("button-go-home")).toBeVisible();

    // Navigate back to dashboard
    await page.getByTestId("button-go-home").click();
    await expect(page.getByText("Dashboard")).toBeVisible();

    // No console errors
    expect(errors).toEqual([]);
  });
});
