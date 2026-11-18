import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenotypeField } from "@/features/pedigree-editor/panels/properties/GenotypeControls";

afterEach(cleanup);

function Field({ onAdd }: { onAdd?: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <>
      <GenotypeField
        inputId="genotype"
        label="Genotype"
        value={value}
        mode="commit"
        onChange={setValue}
        onAdd={onAdd ? () => onAdd(value) : undefined}
      />
      <output aria-label="Saved genotype">{value}</output>
    </>
  );
}

describe("bulk genotype text", () => {
  it("saves typed text when focus leaves the field", () => {
    render(<Field />);
    const input = screen.getByRole("textbox", { name: "Genotype" });
    input.focus();
    fireEvent.change(input, { target: { value: "custom allele" } });
    act(() => input.blur());
    expect(screen.getByLabelText("Saved genotype").textContent).toBe("custom allele");
  });

  it("saves typed text before adding another row", () => {
    const onAdd = vi.fn();
    render(<Field onAdd={onAdd} />);
    const input = screen.getByRole("textbox", { name: "Genotype" });
    input.focus();
    fireEvent.change(input, { target: { value: "typed allele" } });
    const add = screen.getByRole("button", { name: /Add row/ });
    act(() => add.focus());
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith("typed allele");
  });

  it("saves on Enter and allows a later preset selection", () => {
    render(<Field />);
    const input = screen.getByRole("textbox", { name: "Genotype" });
    input.focus();
    fireEvent.change(input, { target: { value: "custom" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("Saved genotype").textContent).toBe("custom");
    fireEvent.click(screen.getByTitle("Set +/+"));
    expect(screen.getByLabelText("Saved genotype").textContent).toBe("+/+");
  });
});
