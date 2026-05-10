export interface KeyboardShortcutHintProps {
  singleSelected: boolean;
}

export function KeyboardShortcutHint({ singleSelected }: KeyboardShortcutHintProps) {
  return (
    <div className="absolute bottom-3 left-3 text-xs text-muted-foreground opacity-40 pointer-events-none">
      {singleSelected
        ? "C child · R partner · B sibling · M/F/U/P/S add · Del delete · Esc clear · ↑↓←→ navigate · Ctrl+Z undo"
        : "M/F/U/P/S add · Del delete · Esc clear · ↑↓←→ navigate · Numpad+/- zoom · Numpad0 fit · Ctrl+Z undo · Ctrl+F find"
      }
    </div>
  );
}