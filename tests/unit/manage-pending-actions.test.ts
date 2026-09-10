import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../src/app/app/manage/page.tsx", import.meta.url),
  "utf8",
);

describe("Manage lifecycle mutation pending states", () => {
  it("acknowledges every lifecycle mutation through the shared pending submit control", () => {
    expect(source).toContain(
      'import { PendingSubmitButton } from "@/components/ui/pending-submit-button";',
    );

    for (const label of [
      "Publishing...",
      "Pausing...",
      "Archiving...",
      "Restoring...",
      "Duplicating...",
    ]) {
      expect(source).toContain(`pendingLabel="${label}"`);
    }
  });
});
