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
    await expect(page.getByRole("heading", { name: "Patients", exact: true })).toBeVisible();
  });

  test("pedigrees page loads successfully", async ({ page }) => {
    await page.goto("/pedigrees");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("nav-pedigrees")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pedigrees", exact: true })).toBeVisible();
  });

  test("profiles page loads successfully", async ({ page }) => {
    await page.goto("/profiles");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "My Identity" })).toBeVisible();
  });

  test("navigation sidebar works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("nav-pedigrees").click();
    await expect(page.getByRole("heading", { name: "Pedigrees", exact: true })).toBeVisible();

    await page.getByTestId("nav-patients").click();
    await expect(page.getByRole("heading", { name: "Patients", exact: true })).toBeVisible();

    await page.getByTestId("nav-dashboard").click();
    await expect(page.getByRole("heading", { name: "Clinical Dashboard", exact: true })).toBeVisible();
  });

  test("theme picker toggles theme options", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Verify theme options are visible in Settings
    await expect(page.getByText("Obsidian")).toBeVisible();
    await expect(page.getByText("Clinical", { exact: true })).toBeVisible();
    await expect(page.getByText("Midnight")).toBeVisible();
    await expect(page.getByText("Warm Neutral")).toBeVisible();
  });

  test("create patient flow", async ({ page }) => {
    await page.goto("/patients");
    await page.waitForLoadState("networkidle");

    // Open create patient dialog
    await page.getByTestId("button-create-patient").click();

    // Fill in patient details
    await page.getByTestId("input-firstName").fill("John");
    await page.getByTestId("input-lastName").fill("Doe");
    // DOB is a custom popover DatePicker component and is optional, so we omit filling it

    // Submit
    await page.getByRole("button", { name: /register|save|create/i }).first().click();
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
    await page.getByRole("button", { name: /register|save|create/i }).first().click();
    await page.waitForTimeout(500);

    // Verify pedigree appears in list
    await expect(page.getByText("Test Family Pedigree", { exact: true })).toBeVisible();
  });

  test("404 page shows on unknown route", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/nonexistent-route");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("button-go-home")).toBeVisible();

    // Navigate back to dashboard
    await page.getByTestId("button-go-home").click();
    await expect(page.getByRole("heading", { name: "Clinical Dashboard", exact: true })).toBeVisible();

    // No console errors
    expect(errors).toEqual([]);
  });
});
