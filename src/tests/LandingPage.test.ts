import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import LandingPage from "../lib/LandingPage.svelte";

describe("LandingPage component", () => {
  it("should render the page title", () => {
    render(LandingPage);

    const heading = screen.getByRole("heading", { name: /gSnake Level Editor/i });
    expect(heading).toBeInTheDocument();
  });

  it("should render the description text", () => {
    render(LandingPage);

    const description = screen.getByText(/Create and edit levels for gSnake/i);
    expect(description).toBeInTheDocument();
  });

  it("should render the Create New Level button", () => {
    render(LandingPage);

    const createButton = screen.getByRole("button", { name: /Create New Level/i });
    expect(createButton).toBeInTheDocument();
  });

  it("should render the Load Existing Level button", () => {
    render(LandingPage);

    const loadButton = screen.getByRole("button", { name: /Load Existing Level/i });
    expect(loadButton).toBeInTheDocument();
  });

  it("dispatches createNew when Create New Level is clicked", async () => {
    const onCreateNew = vi.fn();
    render(LandingPage, {
      events: {
        createNew: onCreateNew,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /Create New Level/i }));

    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it("dispatches loadExisting with selected file when Load Existing Level is clicked", async () => {
    const onLoadExisting = vi.fn();
    render(LandingPage, {
      events: {
        loadExisting: (event: CustomEvent<File>) => {
          onLoadExisting(event.detail);
        },
      },
    });

    const originalCreateElement = document.createElement.bind(document);
    let fileInput: HTMLInputElement | null = null;
    const createElementSpy = vi.spyOn(document, "createElement");
    createElementSpy.mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "input" && element instanceof HTMLInputElement) {
        fileInput = element;
      }
      return element;
    }) as typeof document.createElement);

    try {
      await fireEvent.click(screen.getByRole("button", { name: /Load Existing Level/i }));

      if (fileInput === null) {
        throw new Error("Expected LandingPage to create a file input");
      }

      const selectedInput = fileInput;
      const selectedFile = new File(["{}"], "level.json", { type: "application/json" });
      Object.defineProperty(selectedInput, "files", {
        value: [selectedFile],
        configurable: true,
      });

      await fireEvent.change(selectedInput);

      expect(onLoadExisting).toHaveBeenCalledTimes(1);
      expect(onLoadExisting).toHaveBeenCalledWith(selectedFile);
    } finally {
      createElementSpy.mockRestore();
    }
  });
});
