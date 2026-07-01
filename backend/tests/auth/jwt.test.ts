import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../../src/auth/jwt.js";

describe("jwt", () => {
  it("signs and verifies a token round-trip", () => {
    const token = signToken({ userId: "user_123" });
    expect(typeof token).toBe("string");
    expect(verifyToken(token)).toMatchObject({ userId: "user_123" });
  });

  it("throws on a tampered token", () => {
    expect(() => verifyToken("not.a.token")).toThrow();
  });
});