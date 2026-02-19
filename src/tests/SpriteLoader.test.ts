import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import SpriteLoader from "../lib/SpriteLoader.svelte";

describe("SpriteLoader", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("loads and sanitizes sprite markup before mounting it in the DOM", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '<svg><defs><symbol id="SnakeHead"><path d="M0 0h1v1z"></path></symbol></defs><script>alert(1)</script><g onload="evil()"><use href="#SnakeHead"></use><use href="javascript:alert(2)"></use></g></svg>',
        {
          status: 200,
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
          },
        }
      )
    );

    const { container } = render(SpriteLoader);

    await waitFor(() => {
      expect(container.querySelector(".sprite-loader svg")).toBeInTheDocument();
    });

    const mountedSvg = container.querySelector(".sprite-loader svg");
    expect(mountedSvg).toBeInTheDocument();
    expect(mountedSvg?.querySelector("script")).not.toBeInTheDocument();
    expect(mountedSvg?.querySelector("[onload]")).not.toBeInTheDocument();
    expect(mountedSvg?.querySelector('use[href="javascript:alert(2)"]')).not.toBeInTheDocument();
    expect(mountedSvg?.querySelector("symbol#SnakeHead")).toBeInTheDocument();
  });

  it("rejects non-SVG content types and leaves sprite host empty", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html><body>not svg</body></html>", {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      })
    );

    const { container } = render(SpriteLoader);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(container.querySelector(".sprite-loader svg")).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to load sprite definitions:",
      expect.any(Error)
    );
  });

  it("rejects non-successful responses and leaves sprite host empty", async () => {
    fetchMock.mockResolvedValue(
      new Response("", {
        status: 503,
        statusText: "Service Unavailable",
        headers: {
          "content-type": "image/svg+xml",
        },
      })
    );

    const { container } = render(SpriteLoader);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(container.querySelector(".sprite-loader svg")).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to load sprite definitions:",
      expect.any(Error)
    );
  });
});
