import React from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

export interface SiblingEntry {
  id: string;
  type: PedigreeNode["type"];
  dob: string;
  affected: boolean;
  carrier: boolean;
  deceased: boolean;
  proband: boolean;
  condition: string;
  isSource?: boolean;
}

export function makeSibling(type: PedigreeNode["type"]): SiblingEntry {
  return {
    id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type: type || "unknown",
    dob: "",
    affected: false,
    carrier: false,
    deceased: false,
    proband: false,
    condition: "",
  };
}

export function sexSummary(siblings: SiblingEntry[]): string {
  const counts = { male: 0, female: 0, unknown: 0, pregnancy: 0, sab: 0 };
  for (const s of siblings) {
    if (s.type in counts) {
      counts[s.type]++;
    }
  }
  const parts: string[] = [];
  if (counts.male) parts.push(`${counts.male}M`);
  if (counts.female) parts.push(`${counts.female}F`);
  if (counts.unknown) parts.push(`${counts.unknown}?`);
  return parts.join(" · ") || "—";
}

export function traitsSummary(siblings: SiblingEntry[]): string {
  const counts = { affected: 0, carrier: 0, deceased: 0, proband: 0 };
  for (const s of siblings) {
    if (s.affected) counts.affected++;
    if (s.carrier) counts.carrier++;
    if (s.deceased) counts.deceased++;
    if (s.proband) counts.proband++;
  }
  const parts: string[] = [];
  if (counts.affected) parts.push(`${counts.affected} Affected`);
  if (counts.carrier) parts.push(`${counts.carrier} Carrier`);
  if (counts.deceased) parts.push(`${counts.deceased} Deceased`);
  if (counts.proband) parts.push(`${counts.proband} Proband`);
  return parts.join(" · ");
}

export function renderMiniTraitIcon(type: PedigreeNode["type"], trait: "affected" | "carrier" | "deceased" | "proband", size = 12) {
  const isMale = type === "male";
  const isFemale = type === "female";

  const stroke = "currentColor";
  const strokeWidth = 1.2;

  let shape: React.ReactNode;
  if (isMale) {
    shape = <rect x="2" y="2" width="8" height="8" fill={trait === "affected" ? "currentColor" : "none"} stroke={stroke} strokeWidth={strokeWidth} rx={0.5} />;
  } else if (isFemale) {
    shape = <circle cx="6" cy="6" r="4.5" fill={trait === "affected" ? "currentColor" : "none"} stroke={stroke} strokeWidth={strokeWidth} />;
  } else {
    shape = <polygon points="6,1.5 10.5,6 6,10.5 1.5,6" fill={trait === "affected" ? "currentColor" : "none"} stroke={stroke} strokeWidth={strokeWidth} />;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className="overflow-visible inline-block select-none flex-shrink-0">
      {shape}
      {trait === "carrier" && (
        <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      )}
      {trait === "deceased" && (
        <line x1="0" y1="12" x2="12" y2="0" stroke="currentColor" strokeWidth={1.2} />
      )}
      {trait === "proband" && (
        <path d="M3.5 8.5 L0.5 11.5 M0.5 11.5 L3 11.5 M0.5 11.5 L0.5 9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
