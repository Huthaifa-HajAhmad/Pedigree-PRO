import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/shared/SearchBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dna } from "lucide-react";

async function checkA11y(container: HTMLElement) {
  const results = await axe.run(container);
  expect(results.violations).toEqual([]);
}

describe("Button a11y", () => {
  it("default button has no violations", async () => {
    const { container } = render(<Button>Click me</Button>);
    await checkA11y(container);
  });

  it("destructive variant has no violations", async () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    await checkA11y(container);
  });

  it("outline variant has no violations", async () => {
    const { container } = render(<Button variant="outline">Cancel</Button>);
    await checkA11y(container);
  });
});

describe("SearchBar a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <SearchBar value="" onChange={() => {}} />
    );
    await checkA11y(container);
  });
});

describe("EmptyState a11y", () => {
  it("has no violations", async () => {
    const { container } = render(
      <EmptyState icon={Dna} title="No data" description="Nothing here yet." />
    );
    await checkA11y(container);
  });
});

describe("ConfirmDialog a11y", () => {
  it("has no violations when open", async () => {
    const { container } = render(
      <ConfirmDialog
        open={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    await checkA11y(container);
  });
});
