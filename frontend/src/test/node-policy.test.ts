/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Node policy", () => {
  it("declares the React Router v8 minimum consistently", () => {
    const frontend = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8")
    ) as { engines?: { node?: string } };
    const nvmrc = readFileSync(resolve(process.cwd(), "../.nvmrc"), "utf8").trim();
    expect(frontend.engines?.node).toBe(">=22.22.2");
    expect(nvmrc).toBe("22.22.2");
  });
});
