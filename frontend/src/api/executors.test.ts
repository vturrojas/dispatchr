import { describe, expect, it, vi } from "vitest";
import { api } from "./client";
import { listExecutors } from "./executors";

vi.mock("./client", () => ({ api: vi.fn() }));

describe("listExecutors", () => {
  it("requests the executors collection", async () => {
    const executors = [{ name: "sleep", description: "Wait" }];
    vi.mocked(api).mockResolvedValue(executors);

    await expect(listExecutors()).resolves.toEqual(executors);
    expect(api).toHaveBeenCalledWith("/executors");
  });
});
