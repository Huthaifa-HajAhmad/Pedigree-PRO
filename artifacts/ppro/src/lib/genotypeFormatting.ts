export interface GenotypeSegment {
  text: string;
  italic: boolean;
}

const NON_GENE_TOKENS_LOWER = new Set([
  "wt",
  "mut",
  "del",
  "dup",
  "pos",
  "neg",
  "het",
  "hom",
  "vus",
  "unk",
  "na",
  "carrier",
  "affected",
  "unaffected",
  "normal",
  "wildtype",
  "mutant",
  "variant",
  "pathogenic",
  "benign",
  "exon",
  "intron",
  "xx",
  "xy",
  "xxy",
  "xxx",
  "xyy",
]);

const NON_GENE_LOWERCASE_ONLY = new Set(["ins", "inv", "fs", "ter"]);

// Matches HGVS variant descriptions (e.g. c.68_69del, p.V600E) or candidate
// gene symbols (e.g. BRCA1, TP53, F8, HLA-B, BCR-ABL1).
const GENOTYPE_TOKEN_REGEX =
  /[cgmrnp]\.[A-Za-z0-9_.*+\->]+|[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*/g;

function isGeneNameToken(token: string, prevChar: string | undefined): boolean {
  if (/^[cgmrnp]\./.test(token)) return false;
  if (prevChar && /[Δδμ]/.test(prevChar)) return false;
  if (token.length < 2) return false;
  if (NON_GENE_LOWERCASE_ONLY.has(token)) return false;
  if (NON_GENE_TOKENS_LOWER.has(token.toLowerCase())) return false;
  return true;
}

/**
 * Splits a genotype string into styled segments so written gene names
 * (e.g. `BRCA1`, `TP53`, `HLA-B`) are italicised per HGNC/pedigree convention
 * while allele and chromosome symbols (`+`, `-`, `/`, `+/Y`, punctuation) stay upright.
 */
export function parseGenotypeSegments(genotype: string): GenotypeSegment[] {
  if (!genotype) return [];

  const segments: GenotypeSegment[] = [];
  const push = (text: string, italic: boolean) => {
    if (!text) return;
    const prev = segments[segments.length - 1];
    if (prev && prev.italic === italic) {
      prev.text += text;
    } else {
      segments.push({ text, italic });
    }
  };

  let lastIndex = 0;
  for (const match of genotype.matchAll(GENOTYPE_TOKEN_REGEX)) {
    const idx = match.index ?? 0;
    const token = match[0];

    if (idx > lastIndex) {
      push(genotype.slice(lastIndex, idx), false);
    }

    const prevChar = idx > 0 ? genotype[idx - 1] : undefined;
    push(token, isGeneNameToken(token, prevChar));
    lastIndex = idx + token.length;
  }

  if (lastIndex < genotype.length) {
    push(genotype.slice(lastIndex), false);
  }

  return segments;
}
