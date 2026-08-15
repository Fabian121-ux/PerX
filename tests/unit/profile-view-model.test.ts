import { describe, expect, it } from "vitest";

import {
  formatProfileDateRange,
  normalizePublicProfile,
} from "@/lib/profiles/view-model";

describe("public profile view model", () => {
  it("retains persisted website, portfolio, work history, and privacy", () => {
    const normalized = normalizePublicProfile({
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      emailVerifiedAt: new Date("2024-01-02T00:00:00.000Z"),
      id: "user-1",
      name: "Profile Member",
      profile: {
        allowConnectionRequests: false,
        biography: "Complete biography",
        headline: "Product engineer",
        location: "Private City",
        portfolio: [
          {
            description: "A persisted project",
            id: "portfolio-1",
            title: "Project One",
            url: "https://example.com/project",
          },
        ],
        profileCompleteness: 90,
        showLocation: false,
        showSkills: false,
        skills: [{ name: "Hidden skill" }],
        websiteUrl: "https://example.com",
        workHistory: [
          {
            company: "PerX",
            id: "work-1",
            startedAt: new Date("2023-01-01T00:00:00.000Z"),
            title: "Engineer",
          },
        ],
      },
      roles: [{ role: { label: "Member", name: "MEMBER" } }],
      trustRecordEvidence: {
        averageRating: 4.5,
        completedAgreements: 2,
        publicReviewCount: 2,
      },
      verificationStatus: "VERIFIED",
    });

    expect(normalized).toMatchObject({
      allowConnectionRequests: false,
      location: null,
      portfolio: [{ id: "portfolio-1", title: "Project One" }],
      roles: ["Member"],
      skills: [],
      websiteUrl: "https://example.com/",
      workHistory: [{ id: "work-1", title: "Engineer" }],
    });
  });

  it("rejects unsafe website schemes and formats experience ranges", () => {
    expect(
      normalizePublicProfile({
        id: "user-1",
        profile: { websiteUrl: "javascript:alert(1)" },
      }).websiteUrl,
    ).toBeNull();
    expect(
      formatProfileDateRange(
        new Date("2023-01-01T00:00:00.000Z"),
        new Date("2024-06-01T00:00:00.000Z"),
      ),
    ).toBe("Jan 2023 - Jun 2024");
    expect(
      formatProfileDateRange(new Date("2025-03-01T00:00:00.000Z"), null),
    ).toBe("Mar 2025 - Present");
  });
});
