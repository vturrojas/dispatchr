import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("frontend test harness", () => {
  it("renders accessible React content in jsdom", () => {
    render(<button type="button">Ready</button>);

    expect(screen.getByRole("button", { name: "Ready" })).toBeInTheDocument();
  });
});
