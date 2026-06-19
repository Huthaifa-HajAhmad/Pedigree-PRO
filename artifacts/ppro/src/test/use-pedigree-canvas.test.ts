import { describe, it, expect, vi } from "vitest";

let refIndex = 0;
const refs: any[] = [];
vi.mock("react", () => {
  return {
    useRef: (val: any) => {
      const idx = refIndex++;
      if (!refs[idx]) {
        refs[idx] = { current: val };
      }
      return refs[idx];
    },
    useCallback: (fn: any) => fn
  };
});

import { usePedigreeCanvas } from "../features/pedigree-editor/hooks/use-pedigree-canvas";
import { NODE_GAP } from "../features/pedigree-editor/canvas/types";

describe("usePedigreeCanvas spacing snap", () => {
  it("snaps a dragged node to even spacing relative to a non-moving node on the same row", () => {
    const nodes = [
      { id: "n1", type: "male", x: 100, y: 150, affected: false, carrier: false, deceased: false, proband: false, label: "n1", age: "" },
      { id: "n2", type: "female", x: 180, y: 150, affected: false, carrier: false, deceased: false, proband: false, label: "n2", age: "" }
    ];

    const state = {
      isPreviewMode: false,
      linkMode: false,
      selectedIds: new Set(["n2"]),
      snapEnabled: true,
      snapRows: [150],
      canvas: {
        nodes,
        edges: [],
        annotations: []
      },
      history: [],
      future: []
    } as any;

    const stateRef = { current: state };
    const dispatches: any[] = [];
    const dispatch = vi.fn((action) => {
      dispatches.push(action);
    });

    let currentMouseSVG = { x: 180, y: 150 };
    const svgRef = {
      current: {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: currentMouseSVG.x, y: currentMouseSVG.y })
        }),
        getScreenCTM: () => ({
          inverse: () => ({})
        })
      }
    } as any;

    const lassoRef = { current: null };
    const isLassoingRef = { current: false };
    const lassoRectRef = { current: null };
    const spaceHeldRef = { current: false };
    const preDragCanvasRef = { current: null };
    const rafRef = { current: null };
    const pendingAnnDragRef = { current: null };
    const justCtrlSelectedNodeIdRef = { current: null };

    // Initialize the hook
    refIndex = 0;
    const hook = usePedigreeCanvas({
      stateRef,
      dispatch,
      svgRef,
      lassoRef,
      isLassoingRef,
      lassoRectRef,
      spaceHeldRef,
      preDragCanvasRef,
      rafRef,
      pendingAnnDragRef,
      justCtrlSelectedNodeIdRef
    });

    // Mock requestAnimationFrame to execute synchronously
    const originalRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };

    try {
      // Start drag at (180, 150) for node n2
      const startDragEvent = { clientX: 180, clientY: 150 } as any;
      hook.handleDragStart(startDragEvent, "n2");

      // Move mouse to (200, 150)
      // Moving by dx = 20 horizontally. Node n2's rawX will be 180 + 20 = 200.
      // 200 is close to n1.x + NODE_GAP = 100 + 96.8 = 196.8 (dist = 3.2 < SNAP_THRESHOLD)
      currentMouseSVG = { x: 200, y: 150 };
      const moveEvent = { clientX: 200, clientY: 150 } as any;
      hook.handleMouseMove(moveEvent);

      // Check the dispatches
      const updateCanvasAction = dispatches.find(d => d.type === "UPDATE_CANVAS");
      expect(updateCanvasAction).toBeDefined();

      // Apply the updater to the current canvas
      const updatedCanvas = updateCanvasAction.updater(state.canvas);
      const movingNode = updatedCanvas.nodes.find((n: any) => n.id === "n2");

      // It should snap to n1.x + NODE_GAP = 196.8
      expect(movingNode.x).toBeCloseTo(100 + NODE_GAP, 2);
    } finally {
      global.requestAnimationFrame = originalRAF;
    }
  });

  it("snaps the center of a dragged sibling group to align with a target node on the same row", () => {
    const nodes = [
      { id: "n1", type: "male", x: 250, y: 150, affected: false, carrier: false, deceased: false, proband: false, label: "n1", age: "" },
      { id: "n2", type: "female", x: 180, y: 150, affected: false, carrier: false, deceased: false, proband: false, label: "n2", age: "" },
      { id: "n3", type: "male", x: 240, y: 150, affected: false, carrier: false, deceased: false, proband: false, label: "n3", age: "" }
    ];

    const state = {
      isPreviewMode: false,
      linkMode: false,
      selectedIds: new Set(["n2", "n3"]),
      snapEnabled: true,
      snapRows: [150],
      canvas: {
        nodes,
        edges: [],
        annotations: []
      },
      history: [],
      future: []
    } as any;

    const stateRef = { current: state };
    const dispatches: any[] = [];
    const dispatch = vi.fn((action) => {
      dispatches.push(action);
    });

    let currentMouseSVG = { x: 180, y: 150 };
    const svgRef = {
      current: {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: currentMouseSVG.x, y: currentMouseSVG.y })
        }),
        getScreenCTM: () => ({
          inverse: () => ({})
        })
      }
    } as any;

    const lassoRef = { current: null };
    const isLassoingRef = { current: false };
    const lassoRectRef = { current: null };
    const spaceHeldRef = { current: false };
    const preDragCanvasRef = { current: null };
    const rafRef = { current: null };
    const pendingAnnDragRef = { current: null };
    const justCtrlSelectedNodeIdRef = { current: null };

    // Reset refs state in react mock
    refIndex = 0;
    const hook = usePedigreeCanvas({
      stateRef,
      dispatch,
      svgRef,
      lassoRef,
      isLassoingRef,
      lassoRectRef,
      spaceHeldRef,
      preDragCanvasRef,
      rafRef,
      pendingAnnDragRef,
      justCtrlSelectedNodeIdRef
    });

    const originalRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };

    try {
      // Start drag for n2 (primary)
      const startDragEvent = { clientX: 180, clientY: 150 } as any;
      hook.handleDragStart(startDragEvent, "n2");

      // Move mouse to dx = 30 (clientX = 210)
      // Raw center was (180+240)/2 = 210. Raw dragged center is 210 + 30 = 240.
      // Target n1 is at 250. Distance from raw center 240 to 250 is 10 < SNAP_THRESHOLD.
      // Snapped offset offset = 250 - 210 = 40.
      currentMouseSVG = { x: 210, y: 150 };
      const moveEvent = { clientX: 210, clientY: 150 } as any;
      hook.handleMouseMove(moveEvent);

      const updateCanvasAction = dispatches.find(d => d.type === "UPDATE_CANVAS");
      expect(updateCanvasAction).toBeDefined();

      const updatedCanvas = updateCanvasAction.updater(state.canvas);
      const movedN2 = updatedCanvas.nodes.find((n: any) => n.id === "n2");
      const movedN3 = updatedCanvas.nodes.find((n: any) => n.id === "n3");

      expect(movedN2.x).toBeCloseTo(180 + 40, 2);
      expect(movedN3.x).toBeCloseTo(240 + 40, 2);
    } finally {
      global.requestAnimationFrame = originalRAF;
    }
  });

  it("snaps a dragged node to the exact halfway point between two non-moving nodes on the same row", () => {
    const nodes = [
      { id: "n1", type: "male", x: 100, y: 150, affected: false, carrier: false, deceased: false, proband: false, label: "n1", age: "" },
      { id: "n2", type: "female", x: 150, y: 150, affected: false, carrier: false, deceased: false, proband: false, label: "n2", age: "" },
      { id: "n3", type: "male", x: 300, y: 150, affected: false, carrier: false, deceased: false, proband: false, label: "n3", age: "" }
    ];

    const state = {
      isPreviewMode: false,
      linkMode: false,
      selectedIds: new Set(["n2"]),
      snapEnabled: true,
      snapRows: [150],
      canvas: {
        nodes,
        edges: [],
        annotations: []
      },
      history: [],
      future: []
    } as any;

    const stateRef = { current: state };
    const dispatches: any[] = [];
    const dispatch = vi.fn((action) => {
      dispatches.push(action);
    });

    let currentMouseSVG = { x: 150, y: 150 };
    const svgRef = {
      current: {
        createSVGPoint: () => ({
          x: 0,
          y: 0,
          matrixTransform: () => ({ x: currentMouseSVG.x, y: currentMouseSVG.y })
        }),
        getScreenCTM: () => ({
          inverse: () => ({})
        })
      }
    } as any;

    const lassoRef = { current: null };
    const isLassoingRef = { current: false };
    const lassoRectRef = { current: null };
    const spaceHeldRef = { current: false };
    const preDragCanvasRef = { current: null };
    const rafRef = { current: null };
    const pendingAnnDragRef = { current: null };
    const justCtrlSelectedNodeIdRef = { current: null };

    refIndex = 0;
    const hook = usePedigreeCanvas({
      stateRef,
      dispatch,
      svgRef,
      lassoRef,
      isLassoingRef,
      lassoRectRef,
      spaceHeldRef,
      preDragCanvasRef,
      rafRef,
      pendingAnnDragRef,
      justCtrlSelectedNodeIdRef
    });

    const originalRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb) => {
      cb(0);
      return 0;
    };

    try {
      hook.handleDragStart({ clientX: 150, clientY: 150 } as any, "n2");

      // Midpoint between n1(100) and n3(300) is 200.
      // Move n2 by dx = 50 so raw X is 150 + 50 = 200.
      // Distance from 200 to midpoint 200 is 0 < SNAP_THRESHOLD.
      // Snaps to 200.
      currentMouseSVG = { x: 200, y: 150 };
      hook.handleMouseMove({ clientX: 200, clientY: 150 } as any);

      const updateCanvasAction = dispatches.find(d => d.type === "UPDATE_CANVAS");
      expect(updateCanvasAction).toBeDefined();

      const updatedCanvas = updateCanvasAction.updater(state.canvas);
      const movedN2 = updatedCanvas.nodes.find((n: any) => n.id === "n2");

      expect(movedN2.x).toBeCloseTo(200, 2);
    } finally {
      global.requestAnimationFrame = originalRAF;
    }
  });
});
