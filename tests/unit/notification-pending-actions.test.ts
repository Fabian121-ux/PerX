import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../src/app/app/notifications/page.tsx", import.meta.url),
  "utf8",
);

describe("notification mutation pending states", () => {
  it("routes every notification mutation through the shared pending submit control", () => {
    expect(source).toContain(
      'import { PendingSubmitButton } from "@/components/ui/pending-submit-button";',
    );

    for (const label of [
      "Marking all read...",
      "Accepting...",
      "Declining...",
      "Marking read...",
      "Marking unread...",
    ]) {
      expect(source).toContain(`pendingLabel="${label}"`);
    }

    expect(source).not.toMatch(/<Button\b[^>]*type="submit"/);
  });
});
