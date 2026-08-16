export interface ExportNode {
  id: string;
  type: "male" | "female" | "unknown" | "pregnancy" | "sab";
  affected: boolean;
  affectedLevel?: number;
  carrier: boolean;
  deceased: boolean;
  proband: boolean;
  adopted?: boolean;
  label: string;
  stillbirth?: boolean;
  age: string;
  dob?: string;
  condition?: string;
  notes?: string;
  x: number;
  y: number;
  shading?: string;
  color?: string;
  color2?: string;
  colorQ1?: string;
  colorQ2?: string;
  colorQ3?: string;
  colorQ4?: string;
  genotype?: string;
  genotype2?: string;
  additionalGenotypes?: string[];
}

export interface ExportEdge {
  id: string;
  type: "couple" | "parent-child" | "consanguinity" | "divorced" | "separated";
  sourceId: string;
  targetId: string;
}

export interface ExportAnnotation {
  nodeId: string;
  text: string;
  color: string;
  fontSize: number;
  position: "above" | "below" | "left" | "right";
}

export interface ExportCanvas {
  nodes: ExportNode[];
  edges: ExportEdge[];
  annotations?: ExportAnnotation[];
}

export interface ExportInfo {
  title: string;
  patientId?: number | null;
  notes?: string | null;
}

export interface LegendItem {
  shape: string;
  label: string;
}
