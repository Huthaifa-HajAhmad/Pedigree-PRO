import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Dna } from "lucide-react";

const themes = ["obsidian", "clinical", "midnight", "amber", "rose", "arctic"] as const;

function ThemeWrapper({ theme, children }: { theme: string; children: React.ReactNode }) {
  return <div data-theme={theme === "obsidian" ? undefined : theme}>{children}</div>;
}

async function checkA11y(container: HTMLElement) {
  const results = await axe.run(container);
  expect(results.violations).toEqual([]);
}

describe("Theme a11y", () => {
  themes.forEach((theme) => {
    it(`Button has no contrast violations in ${theme} theme`, async () => {
      const { container } = render(
        <ThemeWrapper theme={theme}>
          <Button>Click me</Button>
        </ThemeWrapper>
      );
      await checkA11y(container);
    });

    it(`Button destructive has no violations in ${theme} theme`, async () => {
      const { container } = render(
        <ThemeWrapper theme={theme}>
          <Button variant="destructive">Delete</Button>
        </ThemeWrapper>
      );
      await checkA11y(container);
    });

    it(`EmptyState has no violations in ${theme} theme`, async () => {
      const { container } = render(
        <ThemeWrapper theme={theme}>
          <EmptyState icon={Dna} title="No items" description="Nothing here." />
        </ThemeWrapper>
      );
      await checkA11y(container);
    });
  });
});
