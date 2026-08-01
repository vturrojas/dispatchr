import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyBlock } from "./CopyBlock";
import { StatusChip } from "./StatusChip";
import { CurlSnippet } from "../forms/CurlSnippet";

describe("presentation helpers", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("presents labeled copyable text and restores the copy action", async () => {
    vi.useFakeTimers();
    render(<CopyBlock label="Job ID" text="job-123" />);

    expect(screen.getByText("Job ID")).toBeInTheDocument();
    expect(screen.getByText("job-123")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy" })));
    expect(writeText).toHaveBeenCalledWith("job-123");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it.each([
    ["RUNNING", "rgb(236, 254, 255)"],
    ["success", "rgb(236, 253, 245)"],
    ["error", "rgb(254, 242, 242)"],
    ["retrying", "rgb(255, 251, 235)"],
    ["enqueued", "rgb(239, 246, 255)"],
    ["unknown", "rgb(243, 244, 246)"],
  ])("styles %s status while retaining its supplied copy", (status, background) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(status)).toHaveStyle({ background });
  });

  it("builds and copies a curl request from type and raw payload", async () => {
    render(<CurlSnippet type="sleep" payloadText={'{"seconds":2}'} />);

    const command = screen.getByText(/curl -X POST/).textContent ?? "";
    const expectedBaseUrl = import.meta.env.VITE_API_BASE_URL as string;
    expect(command).toContain(`"${expectedBaseUrl}/jobs"`);
    expect(command).toContain('"type":"sleep","payload":{"seconds":2}');

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy" })));
    expect(writeText).toHaveBeenCalledWith(command);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
