// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * P0-7 B: the empty feed must not blame a cause that does not exist.
 *
 * The copy read "Connect with founders and explore the ecosystem, and posts
 * will start appearing here", which states that the feed is connection-gated.
 * It is not. `getHomeFeed` falls back to the discovery segment when the network
 * segment returns nothing on the first page (src/lib/data/home-feed.ts), so a
 * viewer with zero connections is already served strangers' posts.
 *
 * An empty feed therefore means the query genuinely returned nothing - there is
 * nothing visible to show. Telling the user to make connections sends them to
 * fix something that was never the problem.
 *
 * Same standard as src/lib/errors/taxonomy.ts: do not assert a cause you have
 * not established.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { HomeFeed } from "@/components/feed/home-feed";

function renderEmptyFeed() {
  return render(
    <HomeFeed
      initialNextCursor={null}
      initialNextSegment={null}
      initialPosts={[]}
      userId="viewer-1"
    />,
  );
}

describe("empty feed copy", () => {
  it("does not claim connections are required", () => {
    const text = renderEmptyFeed().container.textContent ?? "";

    expect(text).not.toMatch(/connect with founders/i);
    // Any phrasing that makes posts conditional on building a network.
    expect(text).not.toMatch(/connect .{0,30}and posts will/i);
  });

  it("still offers a way forward", () => {
    const view = renderEmptyFeed();

    // Honest copy is not the same as a dead end: the actions stay.
    expect(view.getByText("Discover people")).toBeTruthy();
    expect(view.getByText("Explore the ecosystem")).toBeTruthy();
    expect(view.getByText("Create a post")).toBeTruthy();
  });

  it("renders the empty state at all", () => {
    expect(renderEmptyFeed().getByTestId("feed-empty")).toBeTruthy();
  });
});

describe("unavailable feed copy", () => {
  it("asserts no cause and does not pretend to be an empty feed", () => {
    const view = render(
      <HomeFeed
        initialNextCursor={null}
        initialNextSegment={null}
        initialPosts={[]}
        unavailable
        userId="viewer-1"
      />,
    );
    const text = view.container.textContent ?? "";

    // This variant was already honest; the test pins it so it stays that way.
    expect(text).toMatch(/unavailable/i);
    expect(text).toMatch(/no substitute content/i);
    expect(text).not.toMatch(/connect with founders/i);
    expect(text).not.toMatch(/quiet/i);
  });
});
