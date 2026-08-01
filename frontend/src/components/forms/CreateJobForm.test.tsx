import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listExecutors } from "../../api/executors";
import { CreateJobForm } from "./CreateJobForm";

vi.mock("../../api/executors", () => ({ listExecutors: vi.fn() }));

const executors = [
  { name: "sleep", description: "Pause execution", payload_example: { seconds: 3 } },
  { name: "echo", payload_example: { message: "hello" } },
];

describe("CreateJobForm", () => {
  beforeEach(() => vi.mocked(listExecutors).mockReset());
  afterEach(cleanup);

  it("waits for executors, selects examples, and submits parsed JSON", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    vi.mocked(listExecutors).mockResolvedValue(executors);
    render(<CreateJobForm onSubmit={onSubmit} />);

    expect(screen.getByText("No executors returned by API.")).toBeInTheDocument();
    await screen.findByRole("button", { name: /sleep/ });
    expect(screen.getByRole("textbox")).toHaveValue(JSON.stringify({ seconds: 3 }, null, 2));

    await user.click(screen.getByRole("button", { name: /echo/ }));
    expect(screen.getByRole("textbox")).toHaveValue(JSON.stringify({ message: "hello" }, null, 2));
    await user.click(screen.getByRole("button", { name: "Create Job" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ type: "echo", payload: { message: "hello" } }));
  });

  it("shows invalid JSON and prevents submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.mocked(listExecutors).mockResolvedValue(executors);
    render(<CreateJobForm onSubmit={onSubmit} />);

    await screen.findByRole("button", { name: /sleep/ });
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "not-json");

    expect(screen.getByText(/JSON error:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Job" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces rejected executor loading and rejected submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("create refused"));
    vi.mocked(listExecutors).mockRejectedValueOnce(new Error("executor service down"));
    const first = render(<CreateJobForm onSubmit={onSubmit} />);

    expect(await screen.findByText(/executor service down/)).toBeInTheDocument();
    first.unmount();

    vi.mocked(listExecutors).mockResolvedValue(executors);
    render(<CreateJobForm onSubmit={onSubmit} />);
    await screen.findByRole("button", { name: /sleep/ });
    await user.click(screen.getByRole("button", { name: "Create Job" }));

    expect(await screen.findByText(/create refused/)).toBeInTheDocument();
  });

  it("disables submission while a request is in progress", async () => {
    vi.mocked(listExecutors).mockResolvedValue(executors);
    render(<CreateJobForm onSubmit={vi.fn()} submitting />);

    await screen.findByRole("button", { name: /sleep/ });
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });
});
