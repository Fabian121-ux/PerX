import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
it("auth server modules have a compile-time client boundary and use only publishable credentials", () => {
  for (const name of ["supabase-server.ts", "supabase-flow.ts"]) {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/auth", name),
      "utf8",
    );
    expect(source).toMatch(/^import "server-only";/);
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  }
});
it("no client module references service-role credentials", () => {
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.tsx?$/.test(file)) {
        const source = readFileSync(file, "utf8");
        if (/^['"]use client['"];/.test(source))
          expect(source, file).not.toMatch(
            /SUPABASE_SERVICE_ROLE_KEY|TEST_SUPABASE_SERVICE_ROLE_KEY/,
          );
      }
    }
  }
  visit(path.join(process.cwd(), "src"));
});
