# Developer Mode Debugging Aid

Pedigree PRO features a built-in **Developer Mode Visual Debugging Aid** to help engineers and agentic AI systems troubleshoot and verify the behavior of the auto-layout engine and collision-resolver cascades.

## 🎹 How to Activate

Press **`Ctrl + Alt + D`** (or `Cmd + Alt + D` on macOS) while focused on the pedigree editor canvas. This toggles Developer Mode globally across the editor.

---

## 🎨 Visual Indicators Rendered

When Developer Mode is enabled, the SVG canvas overlays the following layout boundaries:

1. **Clearance Collision Zones (Green Dashed Circles)**
   * **Visual**: A dashed green circle centered on each node.
   * **Radius**: `NODE_GAP / 2` (`96.8 / 2 = 48.4` pixels).
   * **Purpose**: Visualizes the node's horizontal clearance zone. If two green circles overlap on the same generation row, it indicates an active collision that the layout engine's safety pass must resolve.

2. **Node Coordinates & IDs (Dark Diagnostic Badges)**
   * **Visual**: A small dark gray pill shape rendered directly above the node.
   * **Content**: `[Node ID] (x, y)` (e.g. `II:5 (438, 240)`).
   * **Purpose**: Provides immediate access to absolute rendering coordinates and database keys without needing to inspect the DOM or console logs.

3. **Generation Row Guides (Red Dashed Lines)**
   * **Visual**: Red dashed horizontal lines across the canvas.
   * **Label**: Renders a red badge on the left margin labeled `Row Y: [Y]` (e.g., `Row Y: 240`).
   * **Purpose**: Identifies the precise Y-boundaries for generation rows, verifying that generation assignments are correctly mapped to integer grids.

---

## 🛠 How to Use for Layout Troubleshooting

1. **Identifying Overlap Traps**:
   * If two nodes are visually overlapping but the layout engine is not shifting them, toggle Developer Mode.
   * If their green dashed circles overlap, but no shift occurs, inspect if one or both nodes are flagged as `pinned: true` in their node data (visualized via the node's anchor pins).

2. **Verifying Cascade Shifts**:
   * Watch the coordinates shift in real-time as you add sibling nodes or draw new relationship lines.
   * Verify that the entire layout keeps consistent horizontal spacing relative to parent midpoints.

3. **Diagnosing Multi-Spouse Crossover Traps**:
   * When dealing with consanguineous marriages, toggle Developer Mode to observe if spouse placement coordinates correctly center around child midpoints.

---

## 🤖 Programmatic Database Seeding (for AI Agents & E2E Tests)

To support headless browser automation, isolated canvas testing, and AI assistant actions, Pedigree PRO exposes the complete unified API client on the global scope:

```javascript
window.apiClient
```

This is loaded in [main.tsx](file:///c:/Users/HSA19/Pedigree%20PRO/artifacts/ppro/src/main.tsx) and is available once the frontend application bundle mounts.

### 💡 Benefits
* **Bypass Onboarding UI**: Pre-populate user clinician profiles directly.
* **Bypass Dashboard UI**: Seed pedigree records in SQLite memory dynamically instead of navigating through pages, clicking forms, and waiting for tables.
* **Canvas Isolation**: Navigate directly to `/pedigrees/:id` to start testing SVG canvas math immediately.

### ⌨️ Example Usage (Console or Playwright `page.evaluate`)

Here is how an AI agent or test script can programmatically initialize a profile and pedigree:

```javascript
const pedigreeId = await page.evaluate(async () => {
  const client = window.apiClient;
  if (!client) throw new Error("apiClient not found");

  // 1. Ensure backend database loaded correctly
  const initError = client.getBackendInitError();
  if (initError) throw initError;

  // 2. Fetch existing profiles or create one
  const profiles = await client.listProfiles();
  let profile = profiles[0];
  if (!profile) {
    profile = await client.createProfile({
      display_name: "Agent Tester",
      role_label: "AI Debugger"
    });
  } else {
    await client.switchProfile(profile.id);
  }

  // 3. Create pedigree record directly in SQLite
  const pedigree = await client.createPedigree({
    title: "Diagnostic Test",
    creator_key: profile.public_key || "",
    canvas_data: JSON.stringify({ nodes: [], edges: [] })
  });

  return pedigree.id;
});

// Direct jump to the canvas editor!
await page.goto(`/pedigrees/${pedigreeId}`);
```
