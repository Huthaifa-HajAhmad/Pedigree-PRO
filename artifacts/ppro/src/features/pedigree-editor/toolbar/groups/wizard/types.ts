import type { CanvasData } from "@/features/pedigree-editor/canvas/types";

export interface PedigreeWizardDialogProps {
  open: boolean;
  onClose: () => void;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData) => void;
  canvasNodes: any[];
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
  runAutoLayout: (respectPinned: boolean, isManual?: boolean, selectedOnly?: boolean) => void;
}

export interface PedigreeWizardConfig {
  generations: 2 | 3;
  includePaternal: boolean;
  paternalUncles: number;
  paternalAunts: number;
  includeMaternal: boolean;
  maternalUncles: number;
  maternalAunts: number;
  probandSex: "male" | "female" | "unknown";
  probandAffected: boolean;
  brothers: number;
  sisters: number;
  hasPartner: boolean;
  partnerSex: "male" | "female" | "unknown";
  sons: number;
  daughters: number;
  affectedFather: boolean;
  affectedMother: boolean;
  affectedPaternalGF: boolean;
  affectedPaternalGM: boolean;
  affectedMaternalGF: boolean;
  affectedMaternalGM: boolean;
  affectedBrothersCount: number;
  affectedSistersCount: number;
  affectedPaternalUnclesCount: number;
  affectedPaternalAuntsCount: number;
  affectedMaternalUnclesCount: number;
  affectedMaternalAuntsCount: number;
  affectedSonsCount: number;
  affectedDaughtersCount: number;
}
