import { describe, expect, it } from "vitest";

import { isDealComposerTrigger } from "@/lib/messages/deal-trigger";

describe("deal composer trigger", () => {
  it.each(["@deal", " @deal ", "@DEAL"])("matches %s", (value) => {
    expect(isDealComposerTrigger(value)).toBe(true);
  });

  it.each(["", "@dealer", "use @deal tomorrow", "deal"])(
    "does not match %s",
    (value) => {
      expect(isDealComposerTrigger(value)).toBe(false);
    },
  );
});
