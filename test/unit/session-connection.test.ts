import { describe, expect, it } from "vitest";

import { buildSessionCliCommand } from "../../web/lib/session-connection.js";

describe("session CLI connection", () => {
  it("builds the documented session connection command", () => {
    expect(buildSessionCliCommand("session-123")).toBe(
      "human2ai session connect --session session-123",
    );
  });

  it("pins the API and web origins when the browser provides one", () => {
    expect(buildSessionCliCommand("session-123", "https://human2ai.test/path")).toBe(
      "human2ai --api-url https://human2ai.test --web-url https://human2ai.test session connect --session session-123",
    );
  });
});
