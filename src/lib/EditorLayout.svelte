<script lang="ts">
  import { Overlay as SharedOverlay } from 'gsnake-web-ui';
  import EntityPalette from './EntityPalette.svelte';
  import GridCanvas from './GridCanvas.svelte';
  import SaveLevelModal from './SaveLevelModal.svelte';
  import HelpModal from './HelpModal.svelte';
  import type { EntityType, GridCell, Direction, LevelData, Position } from './types';
  import { buildLevelExportPayload, generateLevelId } from './levelModel';
  import { parseAndValidateLevelFileData } from './levelFileValidation';
  import { onMount, createEventDispatcher } from 'svelte';
  import toast from 'svelte-5-french-toast';

  const dispatch = createEventDispatcher<{
    newLevel: void;
    loadLevel: LevelData;
  }>();

  export let gridWidth: number;
  export let gridHeight: number;
  export let initialLevelData: LevelData | null = null;

  let selectedEntity: EntityType = 'snake';
  let snakeSegments: { row: number; col: number }[] = []; // Track snake segments in order (head to tail)
  let snakeDirection: Direction = 'east'; // Default direction is East
  let showSaveModal = false; // Control save modal visibility
  let showHelpModal = false; // Control help modal visibility
  let isTestingLevel = false; // Track test level loading state
  let isLoadingFile = false; // Track file loading state
  const TEST_LEVEL_ID = 999999;
  const TEST_LEVEL_NAME = 'Test Level';
  const TEST_LEVEL_DIFFICULTY = 'medium' as const;
  const DEFAULT_SNAKE_DIRECTION: Direction = 'east';
  const DEFAULT_TEST_API_BASE_URL = 'http://localhost:3001';
  const TEST_LEVEL_API_PATH = '/api/test-level';

  function createEmptyGrid(width: number, height: number): GridCell[][] {
    return Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, col) => ({
        row,
        col,
        entity: null as EntityType | null,
        isSnakeSegment: false,
        snakeSegmentIndex: undefined as number | undefined
      }))
    );
  }

  function resetGrid(width: number, height: number): void {
    cells = createEmptyGrid(width, height);
    snakeSegments = [];
    snakeDirection = DEFAULT_SNAKE_DIRECTION;
  }

  function resetSnakeDirectionIfSnakeCleared(): void {
    if (snakeSegments.length === 0) {
      snakeDirection = DEFAULT_SNAKE_DIRECTION;
    }
  }

  function clearCell(row: number, col: number): void {
    cells[row][col].entity = null;
    cells[row][col].isSnakeSegment = false;
    cells[row][col].snakeSegmentIndex = undefined;
  }

  function setCellEntity(row: number, col: number, entity: EntityType | null): void {
    clearCell(row, col);
    cells[row][col].entity = entity;
  }

  // Initialize grid cells
  let cells: GridCell[][] = createEmptyGrid(gridWidth, gridHeight);

  // Helper function to map entity type from position arrays
  function isInGridBounds(position: Position): boolean {
    return (
      position.x >= 0 &&
      position.x < gridWidth &&
      position.y >= 0 &&
      position.y < gridHeight
    );
  }

  function assertAllCoordinatesInBounds(data: LevelData): void {
    const outOfBounds: string[] = [];
    const collectOutOfBounds = (entityName: string, positions: Position[] = []) => {
      positions.forEach((position, index) => {
        if (!isInGridBounds(position)) {
          outOfBounds.push(`${entityName}[${index}] at (${position.x}, ${position.y})`);
        }
      });
    };

    collectOutOfBounds('snake', data.snake);
    collectOutOfBounds('obstacles', data.obstacles || []);
    collectOutOfBounds('food', data.food || []);
    collectOutOfBounds('stones', data.stones || []);
    collectOutOfBounds('spikes', data.spikes || []);
    collectOutOfBounds('floatingFood', data.floatingFood || []);
    collectOutOfBounds('fallingFood', data.fallingFood || []);

    if (data.exit && !isInGridBounds(data.exit)) {
      outOfBounds.push(`exit at (${data.exit.x}, ${data.exit.y})`);
    }

    if (outOfBounds.length > 0) {
      throw new Error(
        `Unsupported out-of-bounds coordinates for grid ${gridWidth}x${gridHeight}: ${outOfBounds.join(', ')}`
      );
    }
  }

  function placeEntitiesFromLevelData(data: LevelData) {
    assertAllCoordinatesInBounds(data);

    // Clear existing state
    resetGrid(gridWidth, gridHeight);

    // Helper to place entities
    const placeEntity = (positions: Position[], entityType: EntityType) => {
      positions.forEach(pos => {
        cells[pos.y][pos.x].entity = entityType;
      });
    };

    // Place snake segments
    data.snake.forEach((pos, index) => {
      cells[pos.y][pos.x].entity = 'snake';
      cells[pos.y][pos.x].isSnakeSegment = true;
      cells[pos.y][pos.x].snakeSegmentIndex = index;
      snakeSegments.push({ row: pos.y, col: pos.x });
    });

    // Missing optional arrays must be treated as empty for backward-compatible
    // LevelDefinition round-trips. See contracts/level-definition-semantics.md.
    // Place other entities
    placeEntity(data.obstacles || [], 'obstacle');
    placeEntity(data.food || [], 'food');
    placeEntity(data.stones || [], 'stone');
    placeEntity(data.spikes || [], 'spike');
    placeEntity(data.floatingFood || [], 'floating-food');
    placeEntity(data.fallingFood || [], 'falling-food');

    // Place exit (single entity)
    if (data.exit) {
      cells[data.exit.y][data.exit.x].entity = 'exit';
    }

    // Set snake direction (convert from "East" to "east")
    if (data.snakeDirection) {
      snakeDirection = data.snakeDirection.toLowerCase() as Direction;
    }

    // Trigger reactivity
    cells = cells;
    snakeSegments = snakeSegments;
  }

  // Load initial level data if provided
  onMount(() => {
    if (initialLevelData) {
      try {
        placeEntitiesFromLevelData(initialLevelData);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to load level: ${message}. Please check that the file is a valid gSnake level JSON.`, {
          duration: 5000,
          style: 'background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
        });
        console.error('Failed to load initial level:', error);
      }
    }
  });

  // Undo/Redo state management using command pattern
  interface EditorState {
    cells: GridCell[][];
    snakeSegments: { row: number; col: number }[];
    direction: Direction;
  }

  interface Command {
    execute(): void;
    undo(): void;
  }

  let undoStack: Command[] = [];
  let redoStack: Command[] = [];

  // Helper to capture current state
  function captureState(): EditorState {
    return {
      cells: cells.map(row => row.map(cell => ({ ...cell }))),
      snakeSegments: snakeSegments.map(seg => ({ ...seg })),
      direction: snakeDirection
    };
  }

  // Helper to restore state
  function restoreState(state: EditorState) {
    cells = state.cells.map(row => row.map(cell => ({ ...cell })));
    snakeSegments = state.snakeSegments.map(seg => ({ ...seg }));
    snakeDirection = state.direction;
  }

  // Create a command for cell modification
  function createCellModificationCommand(
    beforeState: EditorState,
    afterState: EditorState
  ): Command {
    return {
      execute() {
        restoreState(afterState);
      },
      undo() {
        restoreState(beforeState);
      }
    };
  }

  // Execute a command and add to undo history
  function executeCommand(command: Command) {
    command.execute();
    undoStack.push(command);
    redoStack = []; // Clear redo stack on new action
    undoStack = undoStack; // Trigger reactivity
    redoStack = redoStack; // Trigger reactivity
  }

  function handleEntitySelect(event: CustomEvent<EntityType>) {
    selectedEntity = event.detail;

    console.log('Selected entity:', selectedEntity);
  }

  function handleCellDrop(event: CustomEvent<{ row: number; col: number; entityType: EntityType }>) {
    const { row, col, entityType } = event.detail;

    // Capture state before modification
    const beforeState = captureState();

    // Place the dragged entity at the dropped cell (without changing the selected entity)
    if (entityType === 'snake') {
      // For snake drops, place a single segment (not starting a multi-segment placement)
      // Check if this cell already has a snake segment
      const existingSegmentIndex = snakeSegments.findIndex(
        seg => seg.row === row && seg.col === col
      );

      if (existingSegmentIndex === -1) {
        // Clear any non-snake entity at this position
        if (cells[row][col].entity !== null && cells[row][col].entity !== 'snake') {
          clearCell(row, col);
        }

        // Add to snake segments
        snakeSegments.push({ row, col });
        cells[row][col].entity = 'snake';
        cells[row][col].isSnakeSegment = true;
        cells[row][col].snakeSegmentIndex = snakeSegments.length - 1;

        // Trigger reactivity
        cells = cells;
        snakeSegments = snakeSegments;
        console.log(`Dropped snake segment at (${row}, ${col}). Total segments: ${snakeSegments.length}`);
      }
    } else {
      // For other entities, clear any snake segments at this position and place entity
      const segmentIndex = snakeSegments.findIndex(
        seg => seg.row === row && seg.col === col
      );

      if (segmentIndex !== -1) {
        // Remove from snake segments
        snakeSegments.splice(segmentIndex, 1);
        // Update all subsequent segment indices
        for (let i = segmentIndex; i < snakeSegments.length; i++) {
          const seg = snakeSegments[i];
          cells[seg.row][seg.col].snakeSegmentIndex = i;
        }
        resetSnakeDirectionIfSnakeCleared();
        snakeSegments = snakeSegments;
      }

      // For exit entity, ensure only one exists on the grid
      if (entityType === 'exit') {
        // Find and remove existing exit
        for (let r = 0; r < cells.length; r++) {
          for (let c = 0; c < cells[r].length; c++) {
            if (cells[r][c].entity === 'exit' && !(r === row && c === col)) {
              clearCell(r, c);
              console.log(`Removed previous exit at (${r}, ${c}) via drag-drop`);
            }
          }
        }
      }

      // Place dropped entity at cell (replaces existing entity if present)
      setCellEntity(row, col, entityType);

      // Trigger reactivity
      cells = cells;
      console.log(`Dropped ${entityType} at (${row}, ${col})`);
    }

    // Capture state after modification and create command
    const afterState = captureState();
    const command = createCellModificationCommand(beforeState, afterState);
    executeCommand(command);
  }

  function handleCellClick(event: CustomEvent<{ row: number; col: number; shiftKey: boolean }>) {
    const { row, col, shiftKey } = event.detail;

    // Capture state before modification
    const beforeState = captureState();

    // If Shift is pressed, remove entity from the cell
    if (shiftKey) {
      if (cells[row][col].entity === null) {
        console.log(`Cell (${row}, ${col}) is already empty, nothing to remove`);
        return;
      }

      // If it's a snake segment, remove it from the segments array
      if (cells[row][col].isSnakeSegment) {
        const segmentIndex = snakeSegments.findIndex(
          seg => seg.row === row && seg.col === col
        );
        if (segmentIndex !== -1) {
          snakeSegments.splice(segmentIndex, 1);
          // Update all subsequent segment indices
          for (let i = segmentIndex; i < snakeSegments.length; i++) {
            const seg = snakeSegments[i];
            cells[seg.row][seg.col].snakeSegmentIndex = i;
          }
          resetSnakeDirectionIfSnakeCleared();
          snakeSegments = snakeSegments;
        }
      }

      // Clear the cell
      clearCell(row, col);

      // Trigger reactivity
      cells = cells;
      console.log(`Removed entity from (${row}, ${col})`);

      // Capture state after modification and create command
      const afterState = captureState();
      const command = createCellModificationCommand(beforeState, afterState);
      executeCommand(command);
      return;
    }

    if (selectedEntity === 'snake') {
      // Special handling for snake: add to segments array
      const existingSegmentIndex = snakeSegments.findIndex(
        seg => seg.row === row && seg.col === col
      );

      // If clicking on an existing segment, ignore
      if (existingSegmentIndex !== -1) {
        console.log(`Cell (${row}, ${col}) is already a snake segment`);
        return;
      }

      // Clear any non-snake entity at this position
      if (cells[row][col].entity !== null && cells[row][col].entity !== 'snake') {
        clearCell(row, col);
      }

      // Add to snake segments
      snakeSegments.push({ row, col });
      cells[row][col].entity = 'snake';
      cells[row][col].isSnakeSegment = true;
      cells[row][col].snakeSegmentIndex = snakeSegments.length - 1;

      // Trigger reactivity
      cells = cells;
      snakeSegments = snakeSegments;

      console.log(`Added snake segment ${snakeSegments.length - 1} at (${row}, ${col}). Total segments: ${snakeSegments.length}`);

      // Capture state after modification and create command
      const afterState = captureState();
      const command = createCellModificationCommand(beforeState, afterState);
      executeCommand(command);
    } else {
      // For other entities, clear any snake segments at this position and place entity
      const segmentIndex = snakeSegments.findIndex(
        seg => seg.row === row && seg.col === col
      );

      if (segmentIndex !== -1) {
        // Remove from snake segments
        snakeSegments.splice(segmentIndex, 1);
        // Update all subsequent segment indices
        for (let i = segmentIndex; i < snakeSegments.length; i++) {
          const seg = snakeSegments[i];
          cells[seg.row][seg.col].snakeSegmentIndex = i;
        }
        resetSnakeDirectionIfSnakeCleared();
        snakeSegments = snakeSegments;
      }

      // For exit entity, ensure only one exists on the grid
      if (selectedEntity === 'exit') {
        // Find and remove existing exit
        for (let r = 0; r < cells.length; r++) {
          for (let c = 0; c < cells[r].length; c++) {
            if (cells[r][c].entity === 'exit' && !(r === row && c === col)) {
              clearCell(r, c);
              console.log(`Removed previous exit at (${r}, ${c})`);
            }
          }
        }
      }

      // Place selected entity at clicked cell (replaces existing entity if present)
      setCellEntity(row, col, selectedEntity);

      // Trigger reactivity
      cells = cells;
      console.log(`Placed ${selectedEntity} at (${row}, ${col})`);

      // Capture state after modification and create command
      const afterState = captureState();
      const command = createCellModificationCommand(beforeState, afterState);
      executeCommand(command);
    }
  }

  function handleNewLevel() {
    console.log('New Level clicked - returning to landing page');
    dispatch('newLevel');
  }

  async function handleLoad() {
    console.log('Load clicked - opening file picker');

    // Create a hidden file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    const cleanupInput = () => {
      input.removeEventListener('change', handleInputChange);
      input.removeEventListener('cancel', handleInputCancel);
      window.removeEventListener('focus', handleWindowFocus);
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const handleWindowFocus = () => {
      // Browsers without `cancel` support still focus the window when the picker closes.
      window.setTimeout(() => {
        if (!input.files || input.files.length === 0) {
          cleanupInput();
        }
      }, 0);
    };

    const handleInputCancel = () => {
      cleanupInput();
    };

    const handleInputChange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {
        cleanupInput();
        return;
      }

      isLoadingFile = true; // Start loading state

      try {
        const text = await file.text();
        const data = parseAndValidateLevelFileData(text);

        // Reset undo/redo history
        undoStack = [];
        redoStack = [];

        // Apply grid dimensions before explicit reset+placement for loaded entities.
        gridWidth = data.gridSize.width;
        gridHeight = data.gridSize.height;

        // Load the level data
        placeEntitiesFromLevelData(data);

        console.log('Successfully loaded level:', data.name);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to load level: ${message}. Please check that the file is a valid gSnake level JSON.`, {
          duration: 5000,
          style: 'background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
        });
        console.error('Failed to load level:', error);
      } finally {
        isLoadingFile = false; // End loading state
        cleanupInput();
      }
    };

    input.addEventListener('change', handleInputChange);
    input.addEventListener('cancel', handleInputCancel);
    window.addEventListener('focus', handleWindowFocus);

    // Add to DOM and trigger click
    document.body.appendChild(input);
    input.click();
  }

  function handleUndo() {
    if (undoStack.length === 0) {
      console.log('Nothing to undo');
      return;
    }

    const command = undoStack.pop();
    if (command) {
      command.undo();
      redoStack.push(command);
      undoStack = undoStack; // Trigger reactivity
      redoStack = redoStack; // Trigger reactivity
      console.log('Undo performed');
    }
  }

  function handleRedo() {
    if (redoStack.length === 0) {
      console.log('Nothing to redo');
      return;
    }

    const command = redoStack.pop();
    if (command) {
      command.execute();
      undoStack.push(command);
      undoStack = undoStack; // Trigger reactivity
      redoStack = redoStack; // Trigger reactivity
      console.log('Redo performed');
    }
  }

  function handleDirectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    snakeDirection = target.value as Direction;
    console.log('Snake direction changed to:', snakeDirection);
  }

  function getTestLevelApiEndpoint(): string {
    const configuredApiBaseUrl =
      import.meta.env.VITE_GSNAKE_API_URL || DEFAULT_TEST_API_BASE_URL;
    const normalizedApiBaseUrl = configuredApiBaseUrl.replace(/\/+$/, '');
    return `${normalizedApiBaseUrl}${TEST_LEVEL_API_PATH}`;
  }

  function calculateValidationData() {
    let foodCount = 0;
    let hasExit = false;

    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const cell = cells[row][col];
        if (
          cell.entity === 'food' ||
          cell.entity === 'floating-food' ||
          cell.entity === 'falling-food'
        ) {
          foodCount++;
        } else if (cell.entity === 'exit') {
          hasExit = true;
        }
      }
    }

    return {
      snakeCount: snakeSegments.length,
      foodCount,
      hasExit
    };
  }

  function getValidationWarnings(currentValidationData: {
    snakeCount: number;
    foodCount: number;
    hasExit: boolean;
  }): string[] {
    const warnings = [
      currentValidationData.snakeCount === 0 ? 'No snake placed - level is invalid' : null,
      currentValidationData.foodCount === 0 ? 'No food placed - level may not be completable' : null,
      !currentValidationData.hasExit ? 'No exit placed - level cannot be completed' : null
    ];

    return warnings.filter(warning => warning !== null) as string[];
  }

  async function handleTest() {
    console.log('Test clicked - preparing level for testing');

    const currentValidationData = calculateValidationData();
    const validationWarnings = getValidationWarnings(currentValidationData);
    if (validationWarnings.length > 0) {
      toast.error(`Cannot test level: ${validationWarnings.join('. ')}.`, {
        duration: 5000,
        style: 'background: #fff3cd; color: #856404; border-left: 4px solid #ffc107; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
      });
      return;
    }

    isTestingLevel = true; // Start loading state
    const testApiEndpoint = getTestLevelApiEndpoint();

    try {
      const levelData = buildLevelExportPayload({
        levelId: TEST_LEVEL_ID,
        name: TEST_LEVEL_NAME,
        difficulty: TEST_LEVEL_DIFFICULTY,
        gridWidth,
        gridHeight,
        cells,
        snakeSegments,
        snakeDirection
      });

      // POST level to backend server
      const response = await fetch(testApiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(levelData)
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Test level stored:', result);

      // Open gsnake-web in new tab with test mode parameter
      // Use environment variable or default to localhost:3000
      const webUrl = import.meta.env.VITE_GSNAKE_WEB_URL || 'http://localhost:3000';
      window.open(`${webUrl}?test=true`, '_blank');

      toast.success('Test level uploaded successfully! Opening game in new tab...', {
        duration: 5000,
        style: 'background: #d4edda; color: #155724; border-left: 4px solid #4caf50; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
      });

      console.log('Opened gsnake-web in new tab for testing');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(
        `Failed to test level: ${message}. Ensure the test API is reachable at ${testApiEndpoint}. Set VITE_GSNAKE_API_URL or run the local test server on port 3001 (npm run server).`,
        {
          duration: 5000,
          style: 'background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
        }
      );
      console.error('Failed to test level:', error);
    } finally {
      isTestingLevel = false; // End loading state
    }
  }

  let validationData = {
    snakeCount: 0,
    foodCount: 0,
    hasExit: false
  };

  function handleSave() {
    console.log('Save clicked');

    validationData = calculateValidationData();

    showSaveModal = true;
  }

  function handleSaveCancel() {
    console.log('Save cancelled');
    showSaveModal = false;
  }

  function handleHelp() {
    console.log('Help clicked');
    showHelpModal = true;
  }

  function handleHelpClose() {
    console.log('Help closed');
    showHelpModal = false;
  }

  function handleSaveExport(event: CustomEvent<{ name: string; difficulty: 'easy' | 'medium' | 'hard' }>) {
    const { name, difficulty } = event.detail;

    const levelId = generateLevelId();
    const filenameToken = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const levelData = buildLevelExportPayload({
      levelId,
      name,
      difficulty,
      gridWidth,
      gridHeight,
      cells,
      snakeSegments,
      snakeDirection
    });

    // Convert to JSON string with 2-space indentation for readability
    const jsonString = JSON.stringify(levelData, null, 2);

    // Create a Blob and trigger browser download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level-${filenameToken}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Level "${name}" saved successfully!`, {
      duration: 5000,
      style: 'background: #d4edda; color: #155724; border-left: 4px solid #4caf50; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
    });

    console.log('Exported level:', name, difficulty);
    showSaveModal = false;
  }

  // Keyboard shortcut handler for undo/redo
  function handleKeyDown(event: KeyboardEvent) {
    // Check for Ctrl+Z or Cmd+Z (undo)
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
      return;
    }

    // Check for Ctrl+Y (Windows/Linux redo) or Cmd+Shift+Z (Mac redo)
    if (
      (event.ctrlKey && event.key === 'y') ||
      (event.metaKey && event.shiftKey && event.key === 'z')
    ) {
      event.preventDefault();
      handleRedo();
      return;
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="editor-container">
  <!-- Top toolbar -->
  <div class="toolbar">
    <button on:click={handleNewLevel}>New Level</button>
    <button on:click={handleLoad} disabled={isLoadingFile}>
      {#if isLoadingFile}
        <span class="spinner"></span> Loading...
      {:else}
        Load
      {/if}
    </button>
    <button on:click={handleUndo} disabled={undoStack.length === 0}>Undo</button>
    <button on:click={handleRedo} disabled={redoStack.length === 0}>Redo</button>
    <select bind:value={snakeDirection} on:change={handleDirectionChange} class="direction-select">
      <option value="north">North</option>
      <option value="south">South</option>
      <option value="east">East</option>
      <option value="west">West</option>
    </select>
    <button on:click={handleTest} disabled={isTestingLevel}>
      {#if isTestingLevel}
        <span class="spinner"></span> Uploading...
      {:else}
        Test
      {/if}
    </button>
    <button on:click={handleSave}>Save</button>
    <button on:click={handleHelp} class="help-button" title="Keyboard Shortcuts">?</button>
  </div>

  <!-- Main content area with sidebar and canvas -->
  <div class="main-content">
    <!-- Left sidebar for entity palette -->
    <div class="sidebar">
      <h3>Entity Palette</h3>
      <EntityPalette on:select={handleEntitySelect} />
    </div>

    <!-- Center canvas area -->
    <div class="canvas-area">
      <GridCanvas {gridWidth} {gridHeight} {cells} on:cellClick={handleCellClick} on:cellDrop={handleCellDrop} />
    </div>
  </div>
</div>

<!-- Save Level Modal -->
{#if showSaveModal}
  <SaveLevelModal
    snakeCount={validationData.snakeCount}
    foodCount={validationData.foodCount}
    hasExit={validationData.hasExit}
    on:cancel={handleSaveCancel}
    on:export={handleSaveExport}
  />
{/if}

<!-- Help Modal -->
{#if showHelpModal}
  <HelpModal on:close={handleHelpClose} />
{/if}

<SharedOverlay visible={isTestingLevel || isLoadingFile}>
  <div class="loading-overlay">
    <span class="spinner"></span>
    <p>{isLoadingFile ? "Loading level file..." : "Uploading test level..."}</p>
  </div>
</SharedOverlay>

<style>
  .editor-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    gap: 8px;
    padding: 12px;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
    flex-shrink: 0;
  }

  .toolbar button {
    padding: 8px 16px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .toolbar button:hover {
    background-color: #e8e8e8;
  }

  .toolbar button:active {
    background-color: #d8d8d8;
  }

  .toolbar button:disabled {
    background-color: #f5f5f5;
    color: #aaa;
    cursor: not-allowed;
    border-color: #e0e0e0;
  }

  .toolbar button:disabled:hover {
    background-color: #f5f5f5;
  }

  .toolbar .help-button {
    font-size: 18px;
    font-weight: bold;
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: #4caf50;
    color: white;
    border: none;
  }

  .toolbar .help-button:hover {
    background-color: #45a049;
  }

  .toolbar .help-button:active {
    background-color: #3d8b40;
  }

  .toolbar .direction-select {
    padding: 8px 12px;
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  .toolbar .direction-select:hover {
    background-color: #e8e8e8;
  }

  .toolbar .direction-select:focus {
    outline: 2px solid #4caf50;
    outline-offset: 2px;
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .sidebar {
    width: 200px;
    background-color: #fafafa;
    border-right: 1px solid #ddd;
    padding: 16px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .sidebar h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    background-color: #e8e8e8;
    padding: 24px;
  }

  /* Loading spinner */
  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-left-color: #4caf50;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-right: 6px;
    vertical-align: middle;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-overlay {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    color: #333;
  }

  .loading-overlay p {
    margin: 0;
    font-weight: 500;
  }
</style>
