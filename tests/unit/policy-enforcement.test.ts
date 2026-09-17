import { describe, expect, it } from "vitest";

import { evaluatePolicy } from "@/lib/policy/enforcement";

function evaluate(content: string) {
  return evaluatePolicy({ actorId: "member-1", content, entityType: "message" });
}

describe("off-platform brand transition compatibility", () => {
  it.each(["pay me outside perx", "pay me outside ptahx"])(
    "flags %s with the existing off-platform rule",
    (phrase) => {
      expect(evaluate(phrase)).toMatchObject({
        category: "PLATFORM_BYPASS",
        detectorId: "platform-bypass-contact-v1",
        outcome: "FLAG",
      });
    },
  );

  it("preserves platform matching, case insensitivity, and word boundaries", () => {
    expect(evaluate("CONTACT US OFF PLATFORM").outcome).toBe("FLAG");
    expect(evaluate("PAY ME OUTSIDE PTAHX").outcome).toBe("FLAG");
    expect(evaluate("pay me outside ptahxyz").outcome).toBe("ALLOW");
    expect(evaluate("pay me inside ptahx").outcome).toBe("ALLOW");
  });
});
