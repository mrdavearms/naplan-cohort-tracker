import { describe, expect, it } from "vitest";
import { CORE_PACKAGE } from "../src/index";

describe("scaffold smoke test", () => {
  it("core package resolves across the workspace", () => {
    expect(CORE_PACKAGE).toBe("@naplan-throughline/core");
  });
});
