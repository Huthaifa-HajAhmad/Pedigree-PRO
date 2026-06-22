import { test, expect } from "@playwright/test";

test.describe("Pedigree PRO layout and spacing E2E tests", () => {
  let pedigreeId: number;

  test.beforeEach(async ({ page }) => {
    // Go to root to initialize WASM and database
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    
    // Programmatically seed database with a profile and pedigree to bypass onboarding/dashboard UI
    pedigreeId = await page.evaluate(async () => {
      const client = (window as any).apiClient;
      if (!client) throw new Error("apiClient not found on window");

      // Poll until database is fully initialized
      let attempts = 0;
      while (attempts < 20) {
        try {
          const initError = client.getBackendInitError();
          if (initError) throw initError;
          
          const profiles = await client.listProfiles();
          // Database successfully loaded. Ensure a profile exists.
          let activeProfile = profiles[0];
          if (!activeProfile) {
            activeProfile = await client.createProfile({
              display_name: "Dr. Test User",
              role_label: "Clinical Geneticist"
            });
          } else {
            await client.switchProfile(activeProfile.id);
          }

          // Seed a clean pedigree
          const pedigree = await client.createPedigree({
            title: "Spacing Test Pedigree",
            creator_key: activeProfile.public_key || "",
            canvas_data: JSON.stringify({ nodes: [], edges: [] })
          });

          return pedigree.id;
        } catch (err) {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      throw new Error("Failed to initialize database or seed test data");
    });
  });

  test("auto-layout places couple partners with correct spacing and no overlaps", async ({ page }) => {
    // Navigate directly to the pedigree canvas page
    await page.goto(`/pedigrees/${pedigreeId}`);
    await page.waitForLoadState("networkidle");

    // Ensure the SVG canvas is visible
    const canvasSvg = page.locator("svg[data-pedigree-canvas]");
    await expect(canvasSvg).toBeVisible({ timeout: 10000 });

    // Dismiss onboarding tour if it is shown
    const skipBtn = page.getByRole("button", { name: "Skip", exact: true });
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }

    // Click the SVG background to focus it for keyboard shortcuts
    const background = page.locator('[data-canvas-background="true"]');
    await background.click({ force: true });

    // Add first male node (KeyM)
    await page.keyboard.press("KeyM");
    await page.waitForTimeout(200);

    // Verify one node shape is rendered
    const nodeShapesBefore = page.locator('g[role="img"]');
    await expect(nodeShapesBefore).toHaveCount(1);

    // Add partner node (KeyR)
    await page.keyboard.press("KeyR");
    await page.waitForTimeout(200);

    // Verify two node shapes are rendered
    const nodeShapesAfter = page.locator('g[role="img"]');
    await expect(nodeShapesAfter).toHaveCount(2);

    // Run auto-layout (KeyL)
    await page.keyboard.press("KeyL");
    await page.waitForTimeout(600); // allow layout calculations and updates to complete

    // Extract transform attributes to get node coordinates
    const transforms = await nodeShapesAfter.evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("transform"))
    );

    // Parse coordinates from translation strings e.g. translate(120, 240)
    const coordinates = transforms.map((t) => {
      const match = t?.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (!match) return { x: 0, y: 0 };
      return {
        x: parseFloat(match[1] || "0"),
        y: parseFloat(match[2] || "0"),
      };
    });

    expect(coordinates.length).toBe(2);
    const [c1, c2] = coordinates;
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();

    // Check that both nodes are on the same generation row (same Y coordinate)
    expect(c1!.y).toBeCloseTo(c2!.y, 1);

    // Assert that the horizontal distance between the couple partners is exactly 96.8 (NODE_GAP)
    const horizontalDistance = Math.abs(c1!.x - c2!.x);
    expect(horizontalDistance).toBeCloseTo(96.8, 1);
  });
});
