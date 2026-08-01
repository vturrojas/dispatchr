import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "react-router/dom";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./pages/JobsPage", () => ({ JobsPage: () => <h1>Jobs owner</h1> }));
vi.mock("./pages/CreateJobPage", () => ({ CreateJobPage: () => <h1>Create owner</h1> }));
vi.mock("./pages/JobDetailPage", () => ({ JobDetailPage: () => <h1>Detail owner</h1> }));

import { router } from "./router";

describe("application router", () => {
  beforeAll(() => render(<RouterProvider router={router} />));

  it.each([
    ["/jobs", "Jobs owner"],
    ["/jobs/new", "Create owner"],
    ["/jobs/job-123", "Detail owner"],
  ])("assigns %s to its page", async (path, heading) => {
    await router.navigate(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("redirects the root route to jobs", async () => {
    await router.navigate("/");
    await waitFor(() => expect(router.state.location.pathname).toBe("/jobs"));
    expect(screen.getByRole("heading", { name: "Jobs owner" })).toBeInTheDocument();
  });

  it("owns unknown routes with the not-found page", async () => {
    await router.navigate("/not-a-route");
    expect(await screen.findByRole("heading", { name: "404" })).toBeInTheDocument();
    expect(screen.getByText("Route not found")).toBeInTheDocument();
  });
});
