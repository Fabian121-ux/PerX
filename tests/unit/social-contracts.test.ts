import { describe, expect, it } from "vitest";
import { socialPostPath, socialSignInPath } from "@/lib/social/contracts";
describe("social authentication return paths", () => {
  it.each([
    "normal-id",
    "https://evil.example",
    "//evil.example",
    "../admin",
    "id?next=https://evil.example",
    "\\evil.example",
  ])(
    "contains untrusted identifier %s inside the canonical local path",
    (id) => {
      const target = new URL(socialSignInPath(id), "https://ptahx.test");
      expect(target.origin).toBe("https://ptahx.test");
      expect(target.pathname).toBe("/sign-in");
      const next = target.searchParams.get("next")!;
      expect(next).toBe(socialPostPath(id));
      expect(new URL(next, "https://ptahx.test").origin).toBe(
        "https://ptahx.test",
      );
      expect(next).toBe(`/posts/${encodeURIComponent(id)}`);
    },
  );
});
