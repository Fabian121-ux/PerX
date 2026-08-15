import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: string;
    }) => React.createElement("a", { href }, children),
  };
});

import { CursorPagination } from "@/components/cursor-pagination";

describe("cursor pagination controls", () => {
  it("offers first-page recovery and the next opaque cursor", () => {
    const markup = renderToStaticMarkup(
      <CursorPagination
        basePath="/admin/users"
        cursor="current_cursor"
        label="Admin users pagination"
        nextCursor="next_cursor"
      />,
    );

    expect(markup).toContain('aria-label="Admin users pagination"');
    expect(markup).toContain('href="/admin/users"');
    expect(markup).toContain(
      'href="/admin/users?cursor=next_cursor"',
    );
    expect(markup).toContain("First page");
    expect(markup).toContain("Next");
  });

  it("renders no navigation without a current or next cursor", () => {
    expect(
      renderToStaticMarkup(
        <CursorPagination
          basePath="/app/deals"
          label="Agreements pagination"
        />,
      ),
    ).toBe("");
  });
});
