// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) => React.createElement("a", { ...props, href }, children),
  };
});
vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: (props: Record<string, unknown>) => {
      const { alt, fill, priority, sizes, src, ...rest } = props;
      // Surface the Next-specific hints as data attributes so the rendered
      // output can be asserted without depending on the optimizer.
      return React.createElement("img", {
        alt,
        "data-fill": fill ? "true" : undefined,
        "data-priority": priority ? "true" : "false",
        "data-sizes": sizes,
        src,
        ...rest,
      });
    },
  };
});

import { Avatar } from "@/components/ui/avatar";

const repoRoot = path.resolve(__dirname, "../..");

function readSource(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

afterEach(cleanup);

describe("media performance", () => {
  describe("avatars", () => {
    it("requests a source scaled to the rendered size, not the original", () => {
      const view = render(
        <Avatar name="Ada Lovelace" size={44} src="https://cdn.test/a.jpg" />,
      );

      const image = view.container.querySelector("img");
      // A 44px avatar must not download a multi-megabyte upload. Doubling
      // covers 2x displays.
      expect(image?.getAttribute("data-sizes")).toBe("88px");
    });

    it("is lazy by default so a long list fetches nothing off-screen", () => {
      const view = render(
        <Avatar name="Ada Lovelace" src="https://cdn.test/a.jpg" />,
      );

      const image = view.container.querySelector("img");
      expect(image?.getAttribute("loading")).toBe("lazy");
      expect(image?.getAttribute("data-priority")).toBe("false");
    });

    it("allows opting into eager loading for above-the-fold avatars", () => {
      const view = render(
        <Avatar name="Ada Lovelace" priority src="https://cdn.test/a.jpg" />,
      );

      const image = view.container.querySelector("img");
      expect(image?.getAttribute("loading")).toBe("eager");
      expect(image?.getAttribute("data-priority")).toBe("true");
    });

    it("reserves the box so a missing or slow image causes no layout shift", () => {
      const view = render(
        <Avatar name="Ada Lovelace" size={64} src="https://cdn.test/a.jpg" />,
      );

      const wrapper = view.container.firstElementChild as HTMLElement;
      expect(wrapper.style.height).toBe("64px");
      expect(wrapper.style.width).toBe("64px");
    });

    it("reserves the same box for the initials fallback", () => {
      const view = render(<Avatar name="Ada Lovelace" size={64} />);

      const wrapper = view.container.firstElementChild as HTMLElement;
      expect(wrapper.style.height).toBe("64px");
      expect(wrapper.style.width).toBe("64px");
      expect(wrapper.textContent).toBe("AL");
    });
  });

  describe("image configuration", () => {
    const config = readSource("next.config.ts");

    it("permits optimization of uploaded media", () => {
      // Uploads live in Supabase Storage. Without the host listed here,
      // `next/image` refuses to optimize and serves the untouched original.
      expect(config).toContain("supabase.co");
      expect(config).toContain("/storage/v1/object/public/**");
    });

    it("prefers modern formats over the stored JPEG/PNG", () => {
      expect(config).toContain("image/avif");
      expect(config).toContain("image/webp");
    });

    it("caches optimized derivatives for a meaningful period", () => {
      expect(config).toMatch(/minimumCacheTTL/);
    });
  });

  describe("raw image elements", () => {
    /*
      Raw `<img>` bypasses the optimizer entirely, so every one is a full-size
      download. These are the only remaining occurrences, both in owner-only
      upload previews where the source is a local `blob:`/object URL that the
      optimizer cannot process anyway.
    */
    const allowed = [
      "src/components/opportunities/listing-image-manager.tsx",
      "src/app/admin/real-estate/page.tsx",
    ];

    it("keeps raw <img> confined to upload previews and admin tooling", () => {
      for (const file of allowed) {
        expect(readSource(file)).toContain("<img");
      }
    });

    it("has removed raw <img> from high-traffic member surfaces", () => {
      for (const file of [
        "src/components/feed/feed-post-card.tsx",
        "src/components/dashboard/account-menu.tsx",
        "src/app/app/profile/page.tsx",
        "src/app/app/settings/blocked/page.tsx",
      ]) {
        expect(readSource(file)).not.toContain("<img");
      }
    });
  });

  describe("feed media", () => {
    const card = readSource("src/components/feed/feed-post-card.tsx");

    it("constrains post media to the feed column width", () => {
      // The feed column is capped at 640px, so requesting a viewport-width
      // source on a wide monitor would download several times the pixels shown.
      expect(card).toContain('sizes="(max-width: 640px) 100vw, 640px"');
    });

    it("only prioritises the first posts", () => {
      expect(card).toContain("ABOVE_THE_FOLD_COUNT");
      expect(card).toContain("loading={priority ? \"eager\" : \"lazy\"}");
    });

    it("reserves an aspect ratio for post media", () => {
      expect(card).toContain("aspect-[16/8]");
    });
  });
});
