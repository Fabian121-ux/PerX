import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../src/app/app/service-center/page.tsx", import.meta.url),
  "utf8",
);

describe("Service Center ticket links", () => {
  it("links every listed ticket to its authenticated detail route", () => {
    expect(source).toContain("href={`/app/service-center/${ticket.id}`}");
    expect(source).toContain("View request");
  });
});
