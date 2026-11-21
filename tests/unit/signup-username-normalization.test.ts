import { describe, expect, it } from "vitest";
import { normalizeUsernameInput } from "@/lib/validation/username";
import { signUpSchema, signupUsernameSchema, usernameSchema } from "@/lib/validation/auth";

describe("username signup normalization", () => {
  it("accepts spaced names and normalizes them into handles", () => {
    expect(normalizeUsernameInput("  Urama    Chigozie  ")).toBe("urama-chigozie");
    expect(signupUsernameSchema.parse("URAMA chigozie")).toBe("urama-chigozie");
  });

  it("still rejects reserved, short and invalid usernames", () => {
    expect(usernameSchema.safeParse("admin").success).toBe(false);
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(signupUsernameSchema.safeParse("Urama.chigozie").success).toBe(false);
    expect(usernameSchema.safeParse("Urama Chigozie").success).toBe(false);
  });

  it("normalizes username before signup database lookup", () => {
    const result = signUpSchema.safeParse({
      name: "Urama Chigozie",
      username: "Urama Chigozie",
      email: "urama@example.com",
      password: "Validpassword1",
      confirmPassword: "Validpassword1",
      termsAccepted: true,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.username).toBe("urama-chigozie");
  });
});
