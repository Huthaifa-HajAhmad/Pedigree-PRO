import { describe, it, expect } from "vitest";
import { autoDetectConsanguinity, pedigreeEditorReducer } from "@/features/pedigree-editor/context/reducer";
import { INITIAL_STATE } from "@/features/pedigree-editor/context/types";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

describe("Consanguinity Awareness Engine", () => {
  it("auto-detects consanguinity when a couple shares a common ancestor", () => {
    // 3 generations: I:1 & I:2 (parents of II:1 & II:2)
    // II:1 & II:2 are siblings. II:1 is father of III:1. II:2 is mother of III:2.
    // III:1 and III:2 marry. They are first cousins (share I:1 and I:2 as common grandparents).
    const nodes: PedigreeNode[] = [
      { id: "I:1", type: "male", x: 100, y: 100, affected: false, carrier: false, deceased: false, proband: false, label: "I:1", age: "" },
      { id: "I:2", type: "female", x: 200, y: 100, affected: false, carrier: false, deceased: false, proband: false, label: "I:2", age: "" },
      { id: "II:1", type: "male", x: 50, y: 200, affected: false, carrier: false, deceased: false, proband: false, label: "II:1", age: "" },
      { id: "II:2", type: "female", x: 250, y: 200, affected: false, carrier: false, deceased: false, proband: false, label: "II:2", age: "" },
      { id: "III:1", type: "male", x: 100, y: 300, affected: false, carrier: false, deceased: false, proband: false, label: "III:1", age: "" },
      { id: "III:2", type: "female", x: 200, y: 300, affected: false, carrier: false, deceased: false, proband: false, label: "III:2", age: "" },
    ];

    const edges: PedigreeEdge[] = [
      // Gen I couple
      { id: "e1", type: "couple", sourceId: "I:1", targetId: "I:2" },
      // Gen II siblings from Gen I parents
      { id: "e2", type: "parent-child", sourceId: "I:1", targetId: "II:1" },
      { id: "e3", type: "parent-child", sourceId: "I:2", targetId: "II:1" },
      { id: "e4", type: "parent-child", sourceId: "I:1", targetId: "II:2" },
      { id: "e5", type: "parent-child", sourceId: "I:2", targetId: "II:2" },
      // Children
      { id: "e6", type: "parent-child", sourceId: "II:1", targetId: "III:1" },
      { id: "e7", type: "parent-child", sourceId: "II:2", targetId: "III:2" },
      // Couple on Gen III: initially a standard couple edge
      { id: "e8", type: "couple", sourceId: "III:1", targetId: "III:2" },
    ];

    const updated = autoDetectConsanguinity(nodes, edges);
    const targetEdge = updated.find(e => e.id === "e8");
    expect(targetEdge).toBeDefined();
    expect(targetEdge?.type).toBe("consanguinity");
  });

  it("preserves manual consanguinity even if no common ancestors are found", () => {
    const nodes: PedigreeNode[] = [
      { id: "III:1", type: "male", x: 100, y: 300, affected: false, carrier: false, deceased: false, proband: false, label: "III:1", age: "" },
      { id: "III:2", type: "female", x: 200, y: 300, affected: false, carrier: false, deceased: false, proband: false, label: "III:2", age: "" },
    ];

    const edges: PedigreeEdge[] = [
      // Manually marked as consanguinity
      { id: "e8", type: "consanguinity", sourceId: "III:1", targetId: "III:2" },
    ];

    const updated = autoDetectConsanguinity(nodes, edges);
    const targetEdge = updated.find(e => e.id === "e8");
    expect(targetEdge?.type).toBe("consanguinity");
  });

  it("updates consanguinity in the reducer on SET_CANVAS", () => {
    const nodes: PedigreeNode[] = [
      { id: "I:1", type: "male", x: 100, y: 100, affected: false, carrier: false, deceased: false, proband: false, label: "I:1", age: "" },
      { id: "I:2", type: "female", x: 200, y: 100, affected: false, carrier: false, deceased: false, proband: false, label: "I:2", age: "" },
      { id: "II:1", type: "male", x: 50, y: 200, affected: false, carrier: false, deceased: false, proband: false, label: "II:1", age: "" },
      { id: "II:2", type: "female", x: 250, y: 200, affected: false, carrier: false, deceased: false, proband: false, label: "II:2", age: "" },
      { id: "III:1", type: "male", x: 100, y: 300, affected: false, carrier: false, deceased: false, proband: false, label: "III:1", age: "" },
      { id: "III:2", type: "female", x: 200, y: 300, affected: false, carrier: false, deceased: false, proband: false, label: "III:2", age: "" },
    ];

    const edges: PedigreeEdge[] = [
      { id: "e1", type: "couple", sourceId: "I:1", targetId: "I:2" },
      { id: "e2", type: "parent-child", sourceId: "I:1", targetId: "II:1" },
      { id: "e3", type: "parent-child", sourceId: "I:2", targetId: "II:1" },
      { id: "e4", type: "parent-child", sourceId: "I:1", targetId: "II:2" },
      { id: "e5", type: "parent-child", sourceId: "I:2", targetId: "II:2" },
      { id: "e6", type: "parent-child", sourceId: "II:1", targetId: "III:1" },
      { id: "e7", type: "parent-child", sourceId: "II:2", targetId: "III:2" },
      { id: "e8", type: "couple", sourceId: "III:1", targetId: "III:2" },
    ];

    const state = pedigreeEditorReducer(INITIAL_STATE, {
      type: "SET_CANVAS",
      canvas: { nodes, edges, annotations: [] }
    });

    const targetEdge = state.canvas.edges.find(e => e.id === "e8");
    expect(targetEdge?.type).toBe("consanguinity");
  });
});

describe("Version Preview Mode", () => {
  it("handles ENTER_PREVIEW by caching current canvas and switching to preview canvas", () => {
    const originalCanvas = {
      nodes: [{ id: "n1", type: "male", x: 10, y: 10, affected: false, carrier: false, deceased: false, proband: false, label: "n1", age: "" }],
      edges: [],
      annotations: []
    };
    const previewCanvas = {
      nodes: [{ id: "n1", type: "male", x: 10, y: 10, affected: false, carrier: false, deceased: false, proband: false, label: "n1", age: "" }, { id: "n2", type: "female", x: 50, y: 50, affected: false, carrier: false, deceased: false, proband: false, label: "n2", age: "" }],
      edges: [],
      annotations: []
    };

    const initialState = {
      ...INITIAL_STATE,
      canvas: originalCanvas
    };

    const previewState = pedigreeEditorReducer(initialState, {
      type: "ENTER_PREVIEW",
      canvas: previewCanvas,
      versionId: 42
    });

    expect(previewState.isPreviewMode).toBe(true);
    expect(previewState.previewVersionId).toBe(42);
    expect(previewState.liveCanvasCache).toEqual(originalCanvas);
    expect(previewState.canvas).toEqual(previewCanvas);
  });

  it("handles EXIT_PREVIEW by restoring cached canvas", () => {
    const originalCanvas = {
      nodes: [{ id: "n1", type: "male", x: 10, y: 10, affected: false, carrier: false, deceased: false, proband: false, label: "n1", age: "" }],
      edges: [],
      annotations: []
    };
    const previewCanvas = {
      nodes: [{ id: "n1", type: "male", x: 10, y: 10, affected: false, carrier: false, deceased: false, proband: false, label: "n1", age: "" }, { id: "n2", type: "female", x: 50, y: 50, affected: false, carrier: false, deceased: false, proband: false, label: "n2", age: "" }],
      edges: [],
      annotations: []
    };

    const previewState = {
      ...INITIAL_STATE,
      isPreviewMode: true,
      previewVersionId: 42,
      liveCanvasCache: originalCanvas,
      canvas: previewCanvas
    };

    const exitedState = pedigreeEditorReducer(previewState, {
      type: "EXIT_PREVIEW"
    });

    expect(exitedState.isPreviewMode).toBe(false);
    expect(exitedState.previewVersionId).toBeNull();
    expect(exitedState.liveCanvasCache).toBeNull();
    expect(exitedState.canvas).toEqual(originalCanvas);
  });

  it("handles TOGGLE_VISUAL_DIFF to toggle highlight diff boolean state", () => {
    const state = pedigreeEditorReducer(INITIAL_STATE, {
      type: "TOGGLE_VISUAL_DIFF",
      enabled: true
    });
    expect(state.showVisualDiff).toBe(true);

    const toggledOff = pedigreeEditorReducer(state, {
      type: "TOGGLE_VISUAL_DIFF",
      enabled: false
    });
    expect(toggledOff.showVisualDiff).toBe(false);
  });
});

