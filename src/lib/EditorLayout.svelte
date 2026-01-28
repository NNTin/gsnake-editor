<script lang="ts">
  import EntityPalette from './EntityPalette.svelte';
  import GridCanvas from './GridCanvas.svelte';
  import SaveLevelModal from './SaveLevelModal.svelte';
  import HelpModal from './HelpModal.svelte';
  import type { EntityType, GridCell, Direction, LevelData, Position } from './types';
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

  // Initialize grid cells
  let cells: GridCell[][] = Array.from({ length: gridHeight }, (_, row) =>
    Array.from({ length: gridWidth }, (_, col) => ({
      row,
      col,
      entity: null as EntityType | null,
      isSnakeSegment: false,
      snakeSegmentIndex: undefined as number | undefined
    }))
  );

  // Reactive statement to reinitialize grid when dimensions change
  $: if (gridWidth || gridHeight) {
    cells = Array.from({ length: gridHeight }, (_, row) =>
      Array.from({ length: gridWidth }, (_, col) => ({
        row,
        col,
        entity: null as EntityType | null,
        isSnakeSegment: false,
        snakeSegmentIndex: undefined as number | undefined
      }))
    );
  }

  // Helper function to map entity type from position arrays
  function placeEntitiesFromLevelData(data: LevelData) {
    // Clear existing state
    snakeSegments = [];
    cells = Array.from({ length: gridHeight }, (_, row) =>
      Array.from({ length: gridWidth }, (_, col) => ({
        row,
        col,
        entity: null as EntityType | null,
        isSnakeSegment: false,
        snakeSegmentIndex: undefined as number | undefined
      }))
    );

    // Helper to place entities
    const placeEntity = (positions: Position[], entityType: EntityType) => {
      positions.forEach(pos => {
        if (pos.y >= 0 && pos.y < gridHeight && pos.x >= 0 && pos.x < gridWidth) {
          cells[pos.y][pos.x].entity = entityType;
        }
      });
    };

    // Place snake segments
    data.snake.forEach((pos, index) => {
      if (pos.y >= 0 && pos.y < gridHeight && pos.x >= 0 && pos.x < gridWidth) {
        cells[pos.y][pos.x].entity = 'snake';
        cells[pos.y][pos.x].isSnakeSegment = true;
        cells[pos.y][pos.x].snakeSegmentIndex = index;
        snakeSegments.push({ row: pos.y, col: pos.x });
      }
    });

    // Place other entities
    placeEntity(data.obstacles || [], 'obstacle');
    placeEntity(data.food || [], 'food');
    placeEntity(data.stones || [], 'stone');
    placeEntity(data.spikes || [], 'spike');
    placeEntity(data.floatingFood || [], 'floating-food');
    placeEntity(data.fallingFood || [], 'falling-food');

    // Place exit (single entity)
    if (data.exit && data.exit.y >= 0 && data.exit.y < gridHeight && data.exit.x >= 0 && data.exit.x < gridWidth) {
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
      placeEntitiesFromLevelData(initialLevelData);
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
    const previousEntity = selectedEntity;
    selectedEntity = event.detail;

    // FIX BUG #2: When switching TO snake tool and there's already a snake, clear it to start fresh
    if (previousEntity !== 'snake' && selectedEntity === 'snake' && snakeSegments.length > 0) {
      console.log(`Clearing previous snake with ${snakeSegments.length} segments to start a new one`);

      // Clear all snake segments from the grid
      for (const segment of snakeSegments) {
        cells[segment.row][segment.col].entity = null;
        cells[segment.row][segment.col].isSnakeSegment = false;
        cells[segment.row][segment.col].snakeSegmentIndex = undefined;
      }

      // Clear the segments array
      snakeSegments = [];
      cells = cells; // Trigger reactivity

      console.log('Previous snake cleared, ready to draw a new snake');
    }

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
          cells[row][col].entity = null;
          cells[row][col].isSnakeSegment = false;
          cells[row][col].snakeSegmentIndex = undefined;
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
        snakeSegments = snakeSegments;
      }

      // For exit entity, ensure only one exists on the grid
      if (entityType === 'exit') {
        // Find and remove existing exit
        for (let r = 0; r < cells.length; r++) {
          for (let c = 0; c < cells[r].length; c++) {
            if (cells[r][c].entity === 'exit' && !(r === row && c === col)) {
              cells[r][c].entity = null;
              console.log(`Removed previous exit at (${r}, ${c}) via drag-drop`);
            }
          }
        }
      }

      // Place dropped entity at cell (replaces existing entity if present)
      cells[row][col].entity = entityType;
      cells[row][col].isSnakeSegment = false;
      cells[row][col].snakeSegmentIndex = undefined;

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
          snakeSegments = snakeSegments;
        }
      }

      // Clear the cell
      cells[row][col].entity = null;
      cells[row][col].isSnakeSegment = false;
      cells[row][col].snakeSegmentIndex = undefined;

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
        cells[row][col].entity = null;
        cells[row][col].isSnakeSegment = false;
        cells[row][col].snakeSegmentIndex = undefined;
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
        snakeSegments = snakeSegments;
      }

      // For exit entity, ensure only one exists on the grid
      if (selectedEntity === 'exit') {
        // Find and remove existing exit
        for (let r = 0; r < cells.length; r++) {
          for (let c = 0; c < cells[r].length; c++) {
            if (cells[r][c].entity === 'exit' && !(r === row && c === col)) {
              cells[r][c].entity = null;
              console.log(`Removed previous exit at (${r}, ${c})`);
            }
          }
        }
      }

      // Place selected entity at clicked cell (replaces existing entity if present)
      cells[row][col].entity = selectedEntity;
      cells[row][col].isSnakeSegment = false;
      cells[row][col].snakeSegmentIndex = undefined;

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

    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      isLoadingFile = true; // Start loading state

      try {
        const text = await file.text();
        const data = JSON.parse(text) as LevelData;

        // Validate required fields
        if (!data.gridSize || typeof data.gridSize.width !== 'number' || typeof data.gridSize.height !== 'number') {
          throw new Error('Invalid level format: missing or invalid gridSize');
        }
        if (!Array.isArray(data.snake) || data.snake.length === 0) {
          throw new Error('Invalid level format: missing or invalid snake');
        }
        if (!data.snakeDirection) {
          throw new Error('Invalid level format: missing snakeDirection');
        }

        // Validate grid dimensions
        if (data.gridSize.width < 5 || data.gridSize.width > 50 || data.gridSize.height < 5 || data.gridSize.height > 50) {
          throw new Error('Invalid grid dimensions: width and height must be between 5 and 50');
        }

        // Reset undo/redo history
        undoStack = [];
        redoStack = [];

        // Update grid dimensions
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
      } finally{
        isLoadingFile = false; // End loading state
        // Clean up the input element
        document.body.removeChild(input);
      }
    };

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

  async function handleTest() {
    console.log('Test clicked - preparing level for testing');

    isTestingLevel = true; // Start loading state

    // Generate level data (similar to export)
    const obstacles: Position[] = [];
    const food: Position[] = [];
    const stones: Position[] = [];
    const spikes: Position[] = [];
    const floatingFood: Position[] = [];
    const fallingFood: Position[] = [];
    let exit: Position | null = null;

    // Iterate through all cells and collect entities by type
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const cell = cells[row][col];
        const position: Position = { x: col, y: row };

        switch (cell.entity) {
          case 'obstacle':
            obstacles.push(position);
            break;
          case 'food':
            food.push(position);
            break;
          case 'stone':
            stones.push(position);
            break;
          case 'spike':
            spikes.push(position);
            break;
          case 'floating-food':
            floatingFood.push(position);
            break;
          case 'falling-food':
            fallingFood.push(position);
            break;
          case 'exit':
            exit = position;
            break;
        }
      }
    }

    // Convert snake segments to position array
    const snake: Position[] = snakeSegments.map(seg => ({
      x: seg.col,
      y: seg.row
    }));

    // Capitalize first letter of direction
    const snakeDirectionCapitalized =
      snakeDirection.charAt(0).toUpperCase() + snakeDirection.slice(1);

    // Calculate total food (regular food + floating food + falling food)
    const totalFood = food.length + floatingFood.length + fallingFood.length;

    // Build level JSON object
    const levelData = {
      id: 999999, // Test level ID
      name: 'Test Level',
      gridSize: {
        width: gridWidth,
        height: gridHeight
      },
      snake: snake,
      obstacles: obstacles,
      food: food,
      exit: exit,
      snakeDirection: snakeDirectionCapitalized,
      floatingFood: floatingFood,
      fallingFood: fallingFood,
      stones: stones,
      spikes: spikes,
      totalFood: totalFood
    };

    try {
      // POST level to backend server
      const response = await fetch('http://localhost:3001/api/test-level', {
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
        `Failed to test level: ${message}. Make sure the test server is running on port 3001 (npm run server)`,
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

    // Calculate validation data
    let foodCount = 0;
    let hasExit = false;

    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const cell = cells[row][col];
        if (cell.entity === 'food') {
          foodCount++;
        } else if (cell.entity === 'exit') {
          hasExit = true;
        }
      }
    }

    validationData = {
      snakeCount: snakeSegments.length,
      foodCount,
      hasExit
    };

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

    // Generate unique level ID using timestamp + random component
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const levelId = `${timestamp}-${random}`;

    // Convert grid cells to position arrays for each entity type
    const obstacles: Position[] = [];
    const food: Position[] = [];
    const stones: Position[] = [];
    const spikes: Position[] = [];
    const floatingFood: Position[] = [];
    const fallingFood: Position[] = [];
    let exit: Position | null = null;

    // Iterate through all cells and collect entities by type
    for (let row = 0; row < gridHeight; row++) {
      for (let col = 0; col < gridWidth; col++) {
        const cell = cells[row][col];
        const position: Position = { x: col, y: row };

        switch (cell.entity) {
          case 'obstacle':
            obstacles.push(position);
            break;
          case 'food':
            food.push(position);
            break;
          case 'stone':
            stones.push(position);
            break;
          case 'spike':
            spikes.push(position);
            break;
          case 'floating-food':
            floatingFood.push(position);
            break;
          case 'falling-food':
            fallingFood.push(position);
            break;
          case 'exit':
            exit = position;
            break;
          // 'snake' is handled separately via snakeSegments array
        }
      }
    }

    // Convert snake segments to position array
    const snake: Position[] = snakeSegments.map(seg => ({
      x: seg.col,
      y: seg.row
    }));

    // Capitalize first letter of direction to match format (e.g., "east" -> "East")
    const snakeDirectionCapitalized =
      snakeDirection.charAt(0).toUpperCase() + snakeDirection.slice(1);

    // Calculate total food (regular food + floating food + falling food)
    const totalFoodCount = food.length + floatingFood.length + fallingFood.length;

    // Build level JSON object
    const levelData = {
      id: levelId,
      name: name,
      difficulty: difficulty,
      gridSize: {
        width: gridWidth,
        height: gridHeight
      },
      snake: snake,
      obstacles: obstacles,
      food: food,
      exit: exit,
      snakeDirection: snakeDirectionCapitalized,
      floatingFood: floatingFood,
      fallingFood: fallingFood,
      stones: stones,
      spikes: spikes,
      totalFood: totalFoodCount
    };

    // Convert to JSON string with 2-space indentation for readability
    const jsonString = JSON.stringify(levelData, null, 2);

    // Create a Blob and trigger browser download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level-${levelId}.json`;
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
</style>
