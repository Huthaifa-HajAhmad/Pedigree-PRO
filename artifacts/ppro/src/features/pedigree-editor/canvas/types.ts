export interface PedigreeNode {
  id: string;
  type: "male" | "female" | "unknown" | "pregnancy" | "sab";
  affected: boolean;
  carrier: boolean;
  deceased: boolean;
  proband: boolean;
  label: string;
  age: string;
  dob?: string;
  condition?: string;
  notes?: string;
  x: number;
  y: number;
  pinned?: boolean;
}

export interface PedigreeEdge {
  id: string;
  type: "couple" | "parent-child" | "consanguinity";
  sourceId: string;
  targetId: string;
}

export interface PedigreeAnnotation {
  id: string;
  nodeId: string;
  text: string;
  color: string;
  fontSize: number;
  position: "above" | "below" | "left" | "right";
  offsetX?: number;
  offsetY?: number;
}

export interface CanvasData {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
  annotations: PedigreeAnnotation[];
}

export interface DragState {
  primaryNodeId: string;
  startSVG: { x: number; y: number };
  initialPositions: Record<string, { x: number; y: number }>;
}

export const NODE_SIZE = 44;
export const NODE_GAP = NODE_SIZE * 2.2;
export const GEN_GRID = 120;

export const ANNOTATION_COLORS = ["#6475F7", "#FFFFFF", "#FACC15", "#FF4040", "#60A5FA", "#E879F9", "#FB923C"] as const;
export const ANNOTATION_SIZES = [{ label: "S", value: 10 }, { label: "M", value: 12 }, { label: "L", value: 14 }, { label: "XL", value: 16 }] as const;
export const ANNOTATION_POSITIONS = ["above", "below", "left", "right"] as const;