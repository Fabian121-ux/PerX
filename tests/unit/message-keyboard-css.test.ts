import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(
  join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

describe("message mobile keyboard layout", () => {
  it("reduces the mobile conversation viewport by the measured keyboard inset", () => {
    expect(globalsCss).toMatch(
      /:root\[data-perx-keyboard="open"\][\s\S]*?\.message-workspace\[data-mobile-view="conversation"\][\s\S]*?height:\s*calc\(100dvh - var\(--px-keyboard-inset, 0px\)\)/,
    );
  });

  it("keeps composer safe-area padding without adding the keyboard inset twice", () => {
    expect(globalsCss).toMatch(
      /:root\[data-perx-keyboard="open"\][\s\S]*?\.message-composer\s*\{[\s\S]*?padding-bottom:\s*max\(0\.75rem, env\(safe-area-inset-bottom\)\)/,
    );
  });
});
