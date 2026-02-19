import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import "@testing-library/jest-dom";
import EditorLayout from "../lib/EditorLayout.svelte";

function getGridCell(container: HTMLElement, row: number, col: number): HTMLElement {
  const cell = container.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);

  if (!(cell instanceof HTMLElement)) {
    throw new Error(`Grid cell not found at row=${row}, col=${col}`);
  }

  return cell;
}

describe("EditorLayout grid interactions", () => {
  it("supports placement and shift-click removal interactions on the grid", async () => {
    const { container } = render(EditorLayout, {
      gridWidth: 5,
      gridHeight: 5,
      initialLevelData: null,
    });

    const snakeHead = getGridCell(container, 0, 0);
    await fireEvent.click(snakeHead);

    expect(snakeHead).toHaveClass("is-snake-segment");
    expect(snakeHead).toHaveTextContent("H");

    await fireEvent.click(screen.getByRole("button", { name: "Food" }));
    const foodCell = getGridCell(container, 1, 1);
    await fireEvent.click(foodCell);

    expect(foodCell).toHaveClass("has-entity");
    expect(foodCell).not.toHaveClass("is-snake-segment");

    await fireEvent.click(foodCell, { shiftKey: true });

    expect(foodCell).not.toHaveClass("has-entity");
    expect(foodCell).not.toHaveClass("is-snake-segment");
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  it("reindexes snake segment labels when segments are removed and added during edits", async () => {
    const { container } = render(EditorLayout, {
      gridWidth: 5,
      gridHeight: 5,
      initialLevelData: null,
    });

    await fireEvent.click(getGridCell(container, 0, 0));
    await fireEvent.click(getGridCell(container, 0, 1));
    await fireEvent.click(getGridCell(container, 0, 2));

    expect(getGridCell(container, 0, 0)).toHaveTextContent("H");
    expect(getGridCell(container, 0, 1)).toHaveTextContent("1");
    expect(getGridCell(container, 0, 2)).toHaveTextContent("2");

    await fireEvent.click(getGridCell(container, 0, 1), { shiftKey: true });

    expect(getGridCell(container, 0, 1)).not.toHaveClass("is-snake-segment");
    expect(getGridCell(container, 0, 2)).toHaveTextContent("1");

    await fireEvent.click(getGridCell(container, 0, 3));

    expect(getGridCell(container, 0, 3)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 0, 3)).toHaveTextContent("2");
    expect(container.querySelectorAll(".cell.is-snake-segment")).toHaveLength(3);
  });

  it("maintains multi-step undo/redo history and clears redo after a new action", async () => {
    const { container } = render(EditorLayout, {
      gridWidth: 5,
      gridHeight: 5,
      initialLevelData: null,
    });

    const undoButton = screen.getByRole("button", { name: "Undo" });
    const redoButton = screen.getByRole("button", { name: "Redo" });

    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    await fireEvent.click(getGridCell(container, 0, 0));
    await fireEvent.click(getGridCell(container, 0, 1));
    await fireEvent.click(screen.getByRole("button", { name: "Food" }));
    await fireEvent.click(getGridCell(container, 1, 1));

    expect(undoButton).toBeEnabled();
    expect(redoButton).toBeDisabled();
    expect(getGridCell(container, 1, 1)).toHaveClass("has-entity");

    await fireEvent.click(undoButton);
    expect(getGridCell(container, 1, 1)).not.toHaveClass("has-entity");
    expect(redoButton).toBeEnabled();

    await fireEvent.click(undoButton);
    expect(getGridCell(container, 0, 1)).not.toHaveClass("is-snake-segment");

    await fireEvent.click(redoButton);
    expect(getGridCell(container, 0, 1)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 0, 1)).toHaveTextContent("1");

    await fireEvent.click(getGridCell(container, 2, 2));
    expect(getGridCell(container, 2, 2)).toHaveClass("has-entity");
    expect(redoButton).toBeDisabled();
    expect(getGridCell(container, 1, 1)).not.toHaveClass("has-entity");
  });

  it("does not clear existing snake segments when reselecting the snake tool", async () => {
    const { container } = render(EditorLayout, {
      gridWidth: 5,
      gridHeight: 5,
      initialLevelData: null,
    });

    await fireEvent.click(getGridCell(container, 0, 0));
    await fireEvent.click(getGridCell(container, 0, 1));

    expect(getGridCell(container, 0, 0)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 0, 1)).toHaveClass("is-snake-segment");

    await fireEvent.click(screen.getByRole("button", { name: "Food" }));
    await fireEvent.click(screen.getByRole("button", { name: "Snake" }));

    expect(getGridCell(container, 0, 0)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 0, 0)).toHaveTextContent("H");
    expect(getGridCell(container, 0, 1)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 0, 1)).toHaveTextContent("1");
    expect(container.querySelectorAll(".cell.is-snake-segment")).toHaveLength(2);
  });

  it("resets direction to east when edits clear all snake segments before redraw", async () => {
    const { container } = render(EditorLayout, {
      gridWidth: 5,
      gridHeight: 5,
      initialLevelData: null,
    });

    await fireEvent.click(getGridCell(container, 0, 0));
    await fireEvent.click(getGridCell(container, 0, 1));

    const directionSelect = screen.getByRole("combobox");
    await fireEvent.change(directionSelect, { target: { value: "south" } });
    expect(directionSelect).toHaveValue("south");

    await fireEvent.click(screen.getByRole("button", { name: "Food" }));
    await fireEvent.click(getGridCell(container, 0, 0));
    await fireEvent.click(getGridCell(container, 0, 1));

    expect(container.querySelectorAll(".cell.is-snake-segment")).toHaveLength(0);
    expect(directionSelect).toHaveValue("east");

    await fireEvent.click(screen.getByRole("button", { name: "Snake" }));
    await fireEvent.click(getGridCell(container, 1, 1));

    expect(getGridCell(container, 1, 1)).toHaveClass("is-snake-segment");
    expect(getGridCell(container, 1, 1)).toHaveTextContent("H");
    expect(directionSelect).toHaveValue("east");
  });
});
