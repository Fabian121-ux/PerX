// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Field } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";

describe("money input", () => {
  it("keeps canonical text input semantics and forwards attributes", () => {
    const ref = createRef<HTMLInputElement>();
    const view = render(
      <Field label="Budget minimum (NGN)">
        <MoneyInput
          aria-describedby="money-hint"
          aria-label="Budget minimum (NGN)"
          currency="NGN"
          defaultValue="123.45"
          name="amount"
          ref={ref}
        />
      </Field>,
    );
    const input = view.getByLabelText("Budget minimum (NGN)") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.inputMode).toBe("decimal");
    expect(input.value).toBe("123.45");
    expect(input.getAttribute("aria-describedby")).toBe("money-hint");
    expect(input.className).toContain("pl-16");
    expect(input.className).toContain("min-h-11");
    expect(ref.current).toBe(input);
  });
});
