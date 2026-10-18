// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({ alt, src }: { alt: string; src: string }) =>
      React.createElement("img", { alt, src }),
  };
});

import { ListingMediaGallery } from "@/components/opportunities/listing-media-gallery";

afterEach(cleanup);

describe("listing media carousel", () => {
  const photos = [
    { src: "/photo-one.jpg", alt: "Front" },
    { src: "/photo-two.jpg", alt: "Back" },
  ];

  it("supports previous and next photos with an accessible counter", () => {
    render(<ListingMediaGallery photos={photos} />);
    expect(screen.getByRole("img", { name: "Front" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.getByRole("img", { name: "Back" })).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(screen.getByRole("img", { name: "Front" })).toBeTruthy();
  });

  it("supports keyboard controls and hides inactive controls for one image", () => {
    const view = render(<ListingMediaGallery photos={photos} />);
    fireEvent.keyDown(screen.getByRole("region", { name: "Listing photos" }), { key: "ArrowRight" });
    expect(screen.getByRole("img", { name: "Back" })).toBeTruthy();
    view.rerender(<ListingMediaGallery photos={[photos[0]]} />);
    expect(screen.queryByRole("button", { name: "Next photo" })).toBeNull();
  });
});
