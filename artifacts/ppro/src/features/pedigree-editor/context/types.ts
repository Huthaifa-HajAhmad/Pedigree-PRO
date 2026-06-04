import type { CanvasData, PedigreeNode, PedigreeEdge, PedigreeAnnotation, DragState } from "@/features/pedigree-editor/canvas/types";
import type { ValidationResult } from "@/lib/validate-pedigree";
import type { InheritanceMode } from "@/lib/risk-calculator";
import type { PedigreeVersion } from "@workspace/api-client-react";

export interface PedigreeEditorState {
  canvas: CanvasData;
  selectedIds: Set<string>;
  history: CanvasData[];
  future: CanvasData[];
  dragging: DragState | null;
  isDragging: boolean;
  viewBox: { x: number; y: number; zoom: number };
  panning: { startX: number; startY: number; vbX: number; vbY: number } | null;

  showVersions: boolean;
  showSaveModal: boolean;
  sessionLabel: string;
  showShareModal: boolean;
  showExportMenu: boolean;
  exportingFormat: string | null;
  linkMode: "couple" | "parent-child" | "consanguinity" | null;
  linkSource: string | null;
  saveStatus: "idle" | "saving" | "saved";
  snapEnabled: boolean;
  snapRows: number[];
  showValidation: boolean;
  expandedIssueId: string | null;
  showLayoutMenu: boolean;
  liveLayout: boolean;
  showLegend: boolean;
  selectedAnnotationId: string | null;
  annDragging: { annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number }; hasMoved: boolean; labelBelowHeight: number; stackIndex: number } | null;
  showTemplates: boolean;
  riskMode: InheritanceMode;
  showRiskCalc: boolean;
  showRiskPanel: boolean;
  showAutoLabels: boolean;
  showLabelsMenu: boolean;
  showMinimap: boolean;
  showGrid: boolean;
  contextMenu: { nodeId: string; x: number; y: number } | null;
  colorPickerNode: string | null;
  editModalNodeId: string | null;
  showSearch: boolean;
  searchQuery: string;
  searchMatchIndex: number;
  showTabPicker: boolean;

  showVersionTimeline: boolean;
  showFollowMode: boolean;
  showLanShare: boolean;
  followIndex: number;

  twinSelectMode: boolean;
  twinCandidateIds: Set<string>;

  confirmOpen: boolean;
  confirmProps: { title: string; message: string; variant?: "default" | "destructive"; onConfirm: () => void } | null;

  lassoVisible: boolean;
  spaceHeld: boolean;
  showAddSiblingDialog: boolean;
  siblingSourceId: string | null;
  alignGuides: Array<{ axis: "x" | "y"; pos: number; strength: "near" | "snap" }>;
  railX: number;
}

export const INITIAL_STATE: PedigreeEditorState = {
  canvas: { nodes: [], edges: [], annotations: [] },
  selectedIds: new Set<string>(),
  history: [],
  future: [],
  dragging: null,
  isDragging: false,
  viewBox: { x: 0, y: 0, zoom: 1 },
  panning: null,

  showVersions: false,
  showSaveModal: false,
  sessionLabel: "",
  showShareModal: false,
  showExportMenu: false,
  exportingFormat: null,
  linkMode: null,
  linkSource: null,
  saveStatus: "idle" as const,
  snapEnabled: true,
  snapRows: [],
  showValidation: false,
  expandedIssueId: null,
  showLayoutMenu: false,
  liveLayout: false,
  showLegend: false,
  selectedAnnotationId: null,
  annDragging: null,
  showTemplates: false,
  riskMode: "AR" as InheritanceMode,
  showRiskCalc: false,
  showRiskPanel: false,
  showAutoLabels: true,
  showLabelsMenu: false,
  showMinimap: true,
  showGrid: true,
  contextMenu: null,
  colorPickerNode: null,
  editModalNodeId: null,
  showSearch: false,
  searchQuery: "",
  searchMatchIndex: 0,
  showTabPicker: false,

  showVersionTimeline: false,
  showFollowMode: false,
  showLanShare: false,
  followIndex: 0,

  twinSelectMode: false,
  twinCandidateIds: new Set<string>(),

  confirmOpen: false,
  confirmProps: null,

  lassoVisible: false,
  spaceHeld: false,
  showAddSiblingDialog: false,
  siblingSourceId: null,
  alignGuides: [],
  railX: 44,
};

export type PedigreeEditorAction =
  | { type: "SET_STATE"; patch: Partial<PedigreeEditorState> }
  | { type: "SET_CANVAS"; canvas: CanvasData }
  | { type: "UPDATE_CANVAS"; updater: (prev: CanvasData) => CanvasData; pushHistory?: boolean }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "PUSH_DRAFT"; canvas: CanvasData }
  | { type: "REMOVE_EDGES"; edgeIds: string[] };

export interface PedigreeEditorOps {
  updateCanvas: (updater: (prev: CanvasData) => CanvasData, opts?: { skipHistory?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  addNode: (type: PedigreeNode["type"]) => void;
  addContextNode: (rel: "child" | "sibling" | "partner" | "parents") => void;
  toggleNodeProp: (nodeId: string, prop: "affected" | "carrier" | "deceased" | "proband") => void;
  setNodeType: (nodeId: string, type: PedigreeNode["type"]) => void;
  setNodeColor: (nodeId: string, color: string | undefined) => void;
  handleNodeContextMenu: (nodeId: string, e: React.MouseEvent) => void;
  handleNodeDoubleClick: (nodeId: string, e: React.MouseEvent) => void;
  handleNodeClick: (nodeId: string, e: React.MouseEvent) => void;
  deleteSelected: () => void;
  updateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  bulkUpdate: (updates: Partial<PedigreeNode>) => void;
  alignSelected: (axis: "x" | "y") => void;
  addAnnotation: (nodeId: string) => void;
  updateAnnotation: (annId: string, updates: Partial<PedigreeAnnotation>) => void;
  deleteAnnotation: (annId: string) => void;
  runAutoLayout: (resetPins: boolean) => void;
  bakeEmptyLabels: () => void;
  bakeAllLabels: () => void;
  openConfirm: (title: string, message: string, onConfirm: () => void, variant?: "default" | "destructive") => void;
  navigateArrow: (dir: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => void;
  handleCloseTab: (tid: number) => void;
  openTab: (id: number, title: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  renameTab: (tabId: number, newTitle: string) => void;
  fitToScreen: () => void;
  getSVGCoords: (e: { clientX: number; clientY: number }) => { x: number; y: number } | null;
  handleDragStart: (e: React.MouseEvent, nodeId: string) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleSVGMouseDown: (e: React.MouseEvent) => void;
  handleWheel: (e: React.WheelEvent) => void;
  handleSaveVersion: () => void;
  commitSaveVersion: () => void;
  handleDeleteVersion: (versionId: number) => void;
  handleRestoreVersion: (vid: number) => void;
  createConsanguinityEdge: (sourceId: string, targetId: string) => void;
  createCoupleEdge: (sourceId: string, targetId: string) => void;
  addSiblings: (sourceId: string, siblings: Array<{ type: PedigreeNode["type"]; dob: string; affected?: boolean; carrier?: boolean; condition?: string; notes?: string }>) => void;
  markAsTwins: (nodeIds: string[], twinType: "m" | "d") => void;
  unmarkTwins: (nodeIds: string[]) => void;
  removeEdges: (edgeIds: string[]) => void;
  updateEdgeType: (edgeId: string, type: PedigreeEdge["type"]) => void;
  toggleTwinSelectMode: () => void;
  clearTwinCandidates: () => void;
  handleDeletePedigree: (tabId: number, tabTitle: string) => void;
}

export interface PedigreeEditorMemo {
  autoLabels: Map<string, string>;
  validation: ValidationResult;
  searchMatches: string[];
  generationRailEntries: Array<{ roman: string; y: number }>;
  legendEntries: Array<{ key: string; label: string }>;
  visibleGenRows: number[];
  vbW: number;
  vbH: number;
  MM_W: number;
  MM_H: number;
  singleSelected: PedigreeNode | null;
  anySelected: boolean;
  tabItems: Array<{ id: number; title: string }>;
}

export interface PedigreeEditorContextValue {
  state: PedigreeEditorState;
  dispatch: React.Dispatch<PedigreeEditorAction>;
  ops: PedigreeEditorOps;
  memo: PedigreeEditorMemo;
  refs: PedigreeEditorRefs;
  pedigree: { id: number; title: string; canvas_data?: string | null; patient_id?: number | null; notes?: string | null } | undefined;
  versions: PedigreeVersion[] | undefined;
  versionsLoading: boolean;
  saveVersionPending: boolean;
  profiles: Array<{ public_key: string }> | undefined;
  showDraftBanner: boolean;
  onRestoreDraft: () => void;
  handleDismissDraft: () => void;
}

export interface PedigreeEditorRefs {
  svgRef: React.RefObject<SVGSVGElement | null>;
  canvasRef: React.MutableRefObject<CanvasData | null>;
  preDragCanvasRef: React.MutableRefObject<CanvasData | null>;
  lassoRef: React.MutableRefObject<{ startSVG: { x: number; y: number }; curSVG: { x: number; y: number } } | null>;
  isLassoingRef: React.MutableRefObject<boolean>;
  lassoRectRef: React.RefObject<SVGRectElement | null>;
  spaceHeldRef: React.MutableRefObject<boolean>;
  rafRef: React.MutableRefObject<number | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  draftKeyRef: React.MutableRefObject<string>;
  draftEnabledRef: React.MutableRefObject<boolean>;
  pendingAnnDragRef: React.MutableRefObject<{ annId: string; startSVG: { x: number; y: number }; initOffset: { x: number; y: number }; labelBelowHeight: number; stackIndex: number } | null>;
}
