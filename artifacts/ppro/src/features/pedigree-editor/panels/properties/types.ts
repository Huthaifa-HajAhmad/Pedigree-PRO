import type { PedigreeNode, PedigreeEdge, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";

export const COUPLE_LABELS: Record<string, string> = {
  couple: "Couple",
  consanguinity: "Consanguinity",
  divorced: "Divorced",
  separated: "Separated",
};

export function calculateAgeFromDob(dob?: string): string {
  if (!dob) return "";
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return "";
  const today = new Date();
  
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
  months -= birthDate.getMonth();
  months += today.getMonth();
  
  if (today.getDate() < birthDate.getDate()) {
    months--;
  }
  
  if (months < 0) return "";
  if (months < 12) {
    return `${months}m`;
  }
  
  const years = Math.floor(months / 12);
  return String(years);
}

export interface PropertiesPanelProps {
  selectedIds: Set<string>;
  canvasNodes: PedigreeNode[];
  canvasEdges: PedigreeEdge[];
  canvasAnnotations: PedigreeAnnotation[];
  selectedAnnotationId: string | null;
  onUpdateSelectedNode: (updates: Partial<PedigreeNode>) => void;
  onBulkUpdate: (updates: Partial<PedigreeNode> | ((node: PedigreeNode) => Partial<PedigreeNode>)) => void;
  onDeleteSelected: () => void;
  onAddAnnotation: (nodeId: string) => void;
  onUpdateAnnotation: (annId: string, updates: Partial<PedigreeAnnotation>) => void;
  onDeleteAnnotation: (annId: string) => void;
  onSelectAnnotation: (annId: string | null) => void;
  onReorderAnnotations?: (annId: string, direction: "up" | "down") => void;
  onAlignSelected: (axis: "x" | "y") => void;
  onDistributeSelected: (axis: "x" | "y") => void;
  onMarkAsTwins?: (nodeIds: string[], twinType: "m" | "d") => void;
  onUnmarkTwins?: (nodeIds: string[]) => void;
  onRemoveEdges?: (edgeIds: string[]) => void;
  onUpdateEdgeType?: (edgeId: string, type: PedigreeEdge["type"]) => void;
  onToggleCoupleInverted?: (edgeId: string) => void;
  onCreateCoupleEdge?: (sourceId: string, targetId: string) => void;
  onCreateConsanguinityEdge?: (sourceId: string, targetId: string) => void;
  onCreateCoupleAndChild?: (maleId: string, femaleId: string) => void;
  onCreateParentsForGroup?: (nodeIds: string[]) => void;
}
