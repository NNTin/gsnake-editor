<script lang="ts">
  import LandingPage from './lib/LandingPage.svelte'
  import GridSizeModal from './lib/GridSizeModal.svelte'
  import EditorLayout from './lib/EditorLayout.svelte'
  import SpriteLoader from './lib/SpriteLoader.svelte'
  import { parseAndValidateLevelFileData } from './lib/levelFileValidation'
  import type { LevelData } from './lib/types'
  import toast, { Toaster } from 'svelte-5-french-toast'

  let showGridSizeModal = false;
  let showEditor = false;
  let gridWidth = 15;
  let gridHeight = 15;
  let loadedLevelData: LevelData | null = null;

  function handleCreateNew() {
    showGridSizeModal = true;
    loadedLevelData = null; // Clear any loaded data
  }

  async function handleLoadExisting(event: CustomEvent<File>) {
    const file = event.detail;

    try {
      const text = await file.text();
      const data = parseAndValidateLevelFileData(text);

      // Successfully loaded - update state and show editor
      gridWidth = data.gridSize.width;
      gridHeight = data.gridSize.height;
      loadedLevelData = data;
      showEditor = true;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to load level: ${message}. Please check that the file is a valid gSnake level JSON.`, {
        duration: 5000,
        style: 'background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
      });
      console.error('Failed to load level:', error);
      // User returns to landing page (showEditor remains false)
    }
  }

  function handleGridSizeCancel() {
    showGridSizeModal = false;
  }

  function handleGridSizeCreate(event: CustomEvent<{ width: number; height: number }>) {
    gridWidth = event.detail.width;
    gridHeight = event.detail.height;
    loadedLevelData = null; // Creating new level, no loaded data
    showGridSizeModal = false;
    showEditor = true;
  }

  function handleNewLevel() {
    showEditor = false;
    loadedLevelData = null; // Clear loaded data
    console.log('Returned to landing page');
  }
</script>

<Toaster />
<SpriteLoader />

<main>
  {#if showEditor}
    <EditorLayout {gridWidth} {gridHeight} initialLevelData={loadedLevelData} on:newLevel={handleNewLevel} />
  {:else}
    <LandingPage on:createNew={handleCreateNew} on:loadExisting={handleLoadExisting} />

    {#if showGridSizeModal}
      <GridSizeModal on:cancel={handleGridSizeCancel} on:create={handleGridSizeCreate} />
    {/if}
  {/if}
</main>

<style>
  main {
    padding: 0;
    margin: 0;
  }
</style>
