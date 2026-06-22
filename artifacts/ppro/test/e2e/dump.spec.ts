import { test } from "@playwright/test";

test("dump pedigree state", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const canvasData = await page.evaluate(async () => {
    const client = (window as any).apiClient;
    if (!client) throw new Error("apiClient not found");

    let attempts = 0;
    while (attempts < 20) {
      try {
        const initError = client.getBackendInitError();
        if (initError) throw initError;
        
        const profiles = await client.listProfiles();
        const activeProfile = profiles[0];
        if (activeProfile) {
          await client.switchProfile(activeProfile.id);
        }
        
        const pedigrees = await client.listPedigrees();
        if (pedigrees.length > 0) {
          const first = pedigrees[0];
          return {
            title: first.title,
            canvas_data: first.canvas_data
          };
        }
        return null;
      } catch (err) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    return null;
  });

  console.log("=== CANVAS DATA DUMP ===");
  console.log(JSON.stringify(canvasData, null, 2));
  console.log("=== END DUMP ===");
});
