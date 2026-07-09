import type { ThemeId } from "@/lib/theme";
import type { CanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

export interface PedigreeNode {
  id: string;
  type: "male" | "female" | "unknown" | "pregnancy" | "sab";
  affected: boolean;
  affectedLevel?: number;
  carrier: boolean;
  deceased: boolean;
  proband: boolean;
  adopted?: boolean;
  label: string;
  age: string;
  dob?: string;
  condition?: string;
  notes?: string;
  insideText?: string;
  x: number;
  y: number;
  pinned?: boolean;
  color?: string;
  color2?: string;
  genotype?: string;
  shading?: "solid" | "striped" | "cross-hatched" | "dots" | "left-half" | "right-half" | "top-half" | "bottom-half" | "quadrant";
  genotype2?: string;
  additionalGenotypes?: string[];
}

export interface PedigreeEdge {
  id: string;
  type: "couple" | "parent-child" | "consanguinity" | "divorced" | "separated";
  sourceId: string;
  targetId: string;
  twinGroup?: string;
  twinType?: "m" | "d";
  inverted?: boolean;
}

export type CoupleEdgeType = "couple" | "consanguinity" | "divorced" | "separated";

export interface PedigreeAnnotation {
  id: string;
  nodeId: string;
  text: string;
  color: string;
  fontSize: number;
  position: "above" | "below" | "left" | "right";
  offsetX?: number;
  offsetY?: number;
  hidden?: boolean;
  bold?: boolean;
  italic?: boolean;
  uppercase?: boolean;
  x?: number;
  y?: number;
}

export interface CanvasData {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
  annotations: PedigreeAnnotation[];
  settings?: {
    themeId?: ThemeId;
    config?: Partial<CanvasConfig>;
  };
}

export interface DragState {
  primaryNodeId: string;
  startSVG: { x: number; y: number };
  initialPositions: Record<string, { x: number; y: number }>;
}

export const NODE_SIZE = 44;
export const NODE_GAP = NODE_SIZE * 2.2;
export const GEN_GRID = 120;

export const ANNOTATION_COLORS = ["#FFFFFF", "#1F2937", "#6475F7", "#FACC15", "#FF4040", "#60A5FA", "#E879F9", "#FB923C"] as const;
export const ANNOTATION_SIZES = [{ label: "S", value: 10 }, { label: "M", value: 12 }, { label: "L", value: 14 }, { label: "XL", value: 16 }] as const;
export const ANNOTATION_POSITIONS = ["above", "below", "left", "right"] as const;