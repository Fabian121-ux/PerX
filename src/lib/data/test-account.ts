import type { CurrentUser } from "@/lib/auth/session";

export const testUser: CurrentUser = {
  id: "alex-test-local-id",
  email: "alex-test@prex.local",
  name: "Alex Morgan",
  username: "alex-test",
  roles: ["FREELANCER", "CLIENT", "FOUNDER"],
  profile: {
    headline: "Product Engineer & Founder",
    trustScore: 92,
    profileCompleteness: 100,
  },
};
