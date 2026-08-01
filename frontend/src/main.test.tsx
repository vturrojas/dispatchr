import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ render: vi.fn(), createRoot: vi.fn() }));
mocks.createRoot.mockReturnValue({ render: mocks.render });

vi.mock("react-dom/client", () => ({ default: { createRoot: mocks.createRoot } }));
vi.mock("./router", () => ({ router: { fixture: true } }));
vi.mock("react-router/dom", () => ({ RouterProvider: () => null }));

describe("frontend bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.createRoot.mockClear();
    mocks.render.mockClear();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("mounts the router application into the root element", async () => {
    await import("./main");

    expect(mocks.createRoot).toHaveBeenCalledWith(document.getElementById("root"));
    expect(mocks.render).toHaveBeenCalledTimes(1);
  });
});
