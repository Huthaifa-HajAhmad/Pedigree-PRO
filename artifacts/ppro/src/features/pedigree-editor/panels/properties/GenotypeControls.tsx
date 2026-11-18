import { Fragment } from "react";
import { Plus, X } from "lucide-react";

/**
 * Genotype presets grouped by inheritance pattern.
 *
 * `+` is the variant (mutant) allele, `-` is the wild-type allele, matching the
 * colouring used on the canvas (`genotypeMutantColor` / `genotypeWildtypeColor`).
 */
export const AUTOSOMAL_GENOTYPE_PRESETS = ["+/-", "+/+", "-/-"] as const;
export const HEMIZYGOUS_GENOTYPE_PRESETS = ["+/Y", "-/Y"] as const;

/** True when a free-text genotype is sex-chromosome/hemizygous, e.g. `+/Y`. */
export function isHemizygousGenotype(value: string): boolean {
  return /y/i.test(value);
}

/**
 * Renders a genotype string with the same semantic colouring used on the
 * canvas: variant alleles red, wild-type alleles muted, separator faint.
 */
export function GenotypeAlleleText({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center justify-center">
      {Array.from(value).map((char, idx) => (
        <span
          key={idx}
          className={
            char === "+"
              ? "text-destructive font-semibold"
              : char === "-"
                ? "text-foreground/65"
                : "text-muted-foreground/55"
          }
        >
          {char}
        </span>
      ))}
    </span>
  );
}

/**
 * One-tap presets for a genotype row: autosomal trio first, then the
 * hemizygous pair (hidden for female symbols unless the value is already
 * hemizygous, so an X-linked entry stays clearable).
 */
export function GenotypePresetPicker({
  value,
  onSelect,
  showHemizygous = true,
}: {
  value: string;
  onSelect: (preset: string) => void;
  showHemizygous?: boolean;
}) {
  const showHemizygousGroup = showHemizygous || isHemizygousGenotype(value);
  const presets: string[] = showHemizygousGroup
    ? [...AUTOSOMAL_GENOTYPE_PRESETS, ...HEMIZYGOUS_GENOTYPE_PRESETS]
    : [...AUTOSOMAL_GENOTYPE_PRESETS];

  return (
    <div
      role="group"
      aria-label="Genotype presets"
      className="flex items-stretch gap-1 rounded-lg border border-border/60 bg-muted/50 p-0.5"
    >
      {presets.map((preset, idx) => {
        const isActive = value === preset;
        return (
          <Fragment key={preset}>
            {idx === AUTOSOMAL_GENOTYPE_PRESETS.length && showHemizygousGroup && (
              <div aria-hidden className="w-px shrink-0 self-center h-3.5 mx-0.5 bg-border/60" />
            )}
            <button
              type="button"
              aria-pressed={isActive}
              title={isActive ? `Clear ${preset}` : `Set ${preset}`}
              onClick={() => onSelect(isActive ? "" : preset)}
              className={`flex-1 rounded-md border py-1 text-[10px] font-mono leading-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                isActive
                  ? "bg-card border-border shadow-xs"
                  : "border-transparent opacity-70 hover:opacity-100 hover:bg-card/50"
              }`}
            >
              <GenotypeAlleleText value={preset} />
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * A single genotype row: label + add/remove affordance, the free-text input
 * (italic/monospace so the panel matches the canvas), and the preset picker.
 *
 * `mode="commit"` applies bulk edits on Enter or when the input loses focus.
 */
export function GenotypeField({
  label,
  inputId,
  value,
  onChange,
  onAdd,
  onRemove,
  showHemizygous = true,
  mode = "live",
}: {
  label: string;
  inputId: string;
  value: string;
  onChange: (next: string) => void;
  onAdd?: () => void;
  onRemove?: () => void;
  showHemizygous?: boolean;
  mode?: "live" | "commit";
}) {
  const inputClassName =
    "w-full bg-background border border-border/80 rounded-lg px-2.5 py-1 text-xs font-mono italic outline-none hover:bg-accent/20 focus:border-muted-foreground/45 focus-visible:ring-0 shadow-none transition-all duration-200";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 min-h-4">
        <label
          htmlFor={inputId}
          className="text-xs text-muted-foreground uppercase tracking-wider truncate"
        >
          {label}
        </label>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title="Add genotype row"
            className="flex items-center gap-0.5 text-[10px] font-medium text-primary/80 hover:text-primary rounded px-1 py-0.5 -my-0.5 hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Plus className="w-3 h-3" /> Add row
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={`Remove ${label.toLowerCase()}`}
            aria-label={`Remove ${label}`}
            className="flex items-center justify-center w-4 h-4 rounded text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {mode === "commit" ? (
        <input
          id={inputId}
          aria-label={label}
          title="Press Enter to apply to all selected symbols"
          placeholder="e.g. +/-"
          defaultValue={value}
          key={`${inputId}-${value}`}
          className={inputClassName}
          onBlur={(e) => {
            if (e.currentTarget.value !== value) onChange(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      ) : (
        <input
          id={inputId}
          aria-label={label}
          placeholder="e.g. +/-"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
      )}

      <GenotypePresetPicker value={value} onSelect={onChange} showHemizygous={showHemizygous} />
    </div>
  );
}
