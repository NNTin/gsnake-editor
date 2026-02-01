<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { GridCell, EntityType } from './types';

  export let gridWidth: number;
  export let gridHeight: number;
  export let cells: GridCell[][];

  const CELL_SIZE = 32; // 32x32 pixels per cell
  const GRID_GAP = 1; // 1px gap between cells

  const dispatch = createEventDispatcher<{
    cellClick: { row: number; col: number; shiftKey: boolean };
    cellDrop: { row: number; col: number; entityType: EntityType };
  }>();

  let isShiftPressed = false;

  // Entity color map
  const entityColors: Record<EntityType, string> = {
    'snake': '#4caf50',
    'obstacle': '#666',
    'food': '#ff9800',
    'exit': '#2196f3',
    'stone': '#9e9e9e',
    'spike': '#f44336',
    'floating-food': '#ffc107',
    'falling-food': '#ff5722'
  };

  // Calculate total grid dimensions
  $: totalWidth = gridWidth * CELL_SIZE + (gridWidth - 1) * GRID_GAP;
  $: totalHeight = gridHeight * CELL_SIZE + (gridHeight - 1) * GRID_GAP;

  function handleCellClick(row: number, col: number, shiftKey: boolean) {
    dispatch('cellClick', { row, col, shiftKey });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Shift') {
      isShiftPressed = true;
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.key === 'Shift') {
      isShiftPressed = false;
    }
  }

  function getCellBackgroundColor(entity: EntityType | null): string {
    return entity ? entityColors[entity] : 'white';
  }

  function getCellLabel(cell: GridCell): string {
    if (cell.isSnakeSegment && cell.snakeSegmentIndex !== undefined) {
      return cell.snakeSegmentIndex === 0 ? 'H' : String(cell.snakeSegmentIndex);
    }
    return '';
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(event: DragEvent, row: number, col: number) {
    event.preventDefault();
    if (event.dataTransfer) {
      const entityType = event.dataTransfer.getData('entityType') as EntityType;
      if (entityType) {
        dispatch('cellDrop', { row, col, entityType });
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="grid-wrapper" on:keydown={handleKeyDown} on:keyup={handleKeyUp} role="application" tabindex="-1">
  <div
    class="grid"
    style="
      width: {totalWidth}px;
      height: {totalHeight}px;
      gap: {GRID_GAP}px;
      grid-template-columns: repeat({gridWidth}, {CELL_SIZE}px);
    "
  >
    {#each cells as row, rowIndex (rowIndex)}
      {#each row as cell (`${cell.row}-${cell.col}`)}
        <div
          class="cell"
          class:has-entity={cell.entity !== null}
          class:is-snake-segment={cell.isSnakeSegment}
          class:shift-hover={isShiftPressed && cell.entity !== null}
          style="
            width: {CELL_SIZE}px;
            height: {CELL_SIZE}px;
            background-color: {getCellBackgroundColor(cell.entity)};
          "
          data-row={cell.row}
          data-col={cell.col}
          on:click={(e) => handleCellClick(cell.row, cell.col, e.shiftKey)}
          on:keydown={(e) => e.key === 'Enter' && handleCellClick(cell.row, cell.col, e.shiftKey)}
          on:dragover={handleDragOver}
          on:drop={(e) => handleDrop(e, cell.row, cell.col)}
          role="button"
          tabindex="0"
        >
          {#if cell.isSnakeSegment}
            <span class="segment-label">{getCellLabel(cell)}</span>
          {/if}
        </div>
      {/each}
    {/each}
  </div>
</div>

<style>
  .grid-wrapper {
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .grid {
    display: grid;
    background-color: #e0e0e0; /* Background shows as gaps between cells */
  }

  .cell {
    border: 1px solid #ddd;
    box-sizing: border-box;
    cursor: pointer;
    transition: opacity 0.1s;
    position: relative;
  }

  .cell:hover::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.1);
    pointer-events: none;
  }

  .shift-hover {
    cursor: not-allowed;
  }

  .shift-hover:hover::after {
    background-color: rgba(255, 0, 0, 0.3);
  }

  .cell:focus {
    outline: 2px solid #2196f3;
    outline-offset: -2px;
  }

  .is-snake-segment {
    box-shadow: inset 0 0 0 2px rgba(76, 175, 80, 0.5);
  }

  .segment-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: bold;
    color: white;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
    user-select: none;
    pointer-events: none;
  }
</style>
