import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import EntityPalette from "../lib/EntityPalette.svelte";

describe("EntityPalette", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds drag preview SVG with DOM APIs and sets drag payload", async () => {
    vi.useFakeTimers();

    render(EntityPalette);

    const button = screen.getByRole("button", { name: "Food" });
    const setData = vi.fn();
    const setDragImage = vi.fn();

    const dataTransfer = {
      effectAllowed: "none",
      setData,
      setDragImage,
    } as unknown as DataTransfer;

    const dragStartEvent = new Event("dragstart", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(dragStartEvent, "dataTransfer", {
      value: dataTransfer,
    });

    await fireEvent(button, dragStartEvent);

    expect(dataTransfer.effectAllowed).toBe("copy");
    expect(setData).toHaveBeenCalledWith("entityType", "food");
    expect(setDragImage).toHaveBeenCalledTimes(1);

    const [dragImage, offsetX, offsetY] = setDragImage.mock.calls[0];
    expect(offsetX).toBe(16);
    expect(offsetY).toBe(16);
    expect(dragImage).toBeInstanceOf(HTMLDivElement);

    const dragImageElement = dragImage as HTMLDivElement;
    expect(dragImageElement.querySelector("svg")).toBeInTheDocument();
    expect(dragImageElement.querySelector("use")).toHaveAttribute("href", "#Food");
    expect(document.body.contains(dragImageElement)).toBe(true);

    vi.runAllTimers();
    expect(document.body.contains(dragImageElement)).toBe(false);
  });
});
