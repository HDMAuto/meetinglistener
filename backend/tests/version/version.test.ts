import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { latestVersionFrom } from "../../src/version/version.service.js";

const app = createApp();

describe("latestVersionFrom", () => {
  it("parses versions out of real installer names and picks the highest", () => {
    expect(
      latestVersionFrom(["Briefly-0.2.0-universal.dmg", "Briefly Setup 0.3.0.exe"]),
    ).toBe("0.3.0");
  });

  it("compares segments numerically, not lexically", () => {
    expect(
      latestVersionFrom(["Briefly-0.9.0-universal.dmg", "Briefly-0.10.0-universal.dmg"]),
    ).toBe("0.10.0");
  });

  it("skips dotfiles, blockmaps, and unversioned names", () => {
    expect(
      latestVersionFrom([
        ".DS_Store",
        "Briefly-0.2.0-universal.dmg.blockmap",
        "readme.txt",
        "Briefly-0.2.0-universal.dmg",
      ]),
    ).toBe("0.2.0");
  });

  it("returns null when nothing is versioned", () => {
    expect(latestVersionFrom([])).toBeNull();
    expect(latestVersionFrom(["readme.txt"])).toBeNull();
  });
});

describe("GET /version", () => {
  it("is public and returns the latest shape", async () => {
    const res = await request(app).get("/version");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("latest");
    expect(res.body.latest === null || typeof res.body.latest === "string").toBe(true);
  });
});
