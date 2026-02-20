import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import GridSizeModal from "../lib/GridSizeModal.svelte";

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("svelte-5-french-toast", () => ({
  default: toastMock,
}));

describe("GridSizeModal", () => {
  beforeEach(() => {
    toastMock.error.mockReset();
  });

  it("uses integer-only input constraints for width and height", () => {
    render(GridSizeModal);

    const widthInput = screen.getByLabelText("Width");
    const heightInput = screen.getByLabelText("Height");

    expect(widthInput).toHaveAttribute("step", "1");
    expect(heightInput).toHaveAttribute("step", "1");
  });

  it("rejects decimal dimensions and does not dispatch create", async () => {
    const onCreate = vi.fn();
    render(GridSizeModal, {
      events: {
        create: onCreate,
      },
    });

    const widthInput = screen.getByLabelText("Width");
    const heightInput = screen.getByLabelText("Height");

    await fireEvent.input(widthInput, { target: { value: "10.5" } });
    await fireEvent.input(heightInput, { target: { value: "8" } });
    await fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith(
      "Width and height must be whole numbers between 5 and 50",
      expect.any(Object)
    );
  });

  it("dispatches create for valid integer dimensions", async () => {
    const onCreate = vi.fn();
    render(GridSizeModal, {
      events: {
        create: onCreate,
      },
    });

    const widthInput = screen.getByLabelText("Width");
    const heightInput = screen.getByLabelText("Height");

    await fireEvent.input(widthInput, { target: { value: "10" } });
    await fireEvent.input(heightInput, { target: { value: "8" } });
    await fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].detail).toEqual({ width: 10, height: 8 });
  });
});
