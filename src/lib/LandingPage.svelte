<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    createNew: void;
    loadExisting: File;
  }>();

  function handleCreateNew() {
    dispatch('createNew');
  }

  function handleLoadExisting() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        dispatch('loadExisting', file);
      }
    };
    input.click();
  }
</script>

<div class="landing-container">
  <div class="landing-card">
    <h1>gSnake Level Editor</h1>
    <p>Create and edit levels for gSnake</p>

    <div class="button-group">
      <button class="primary-button" on:click={handleCreateNew}>
        Create New Level
      </button>
      <button class="secondary-button" on:click={handleLoadExisting}>
        Load Existing Level
      </button>
    </div>
  </div>
</div>

<style>
  .landing-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: #f5f5f5;
  }

  .landing-card {
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
    padding: 3rem;
    text-align: center;
    max-width: 500px;
    width: 100%;
  }

  h1 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 2rem;
  }

  p {
    margin: 0 0 2rem 0;
    color: #666;
    font-size: 1rem;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .primary-button,
  .secondary-button {
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }

  .primary-button {
    background-color: #4caf50;
    color: white;
  }

  .primary-button:hover {
    background-color: #45a049;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
  }

  .secondary-button {
    background-color: #f9f9f9;
    color: #333;
    border: 1px solid #ddd;
  }

  .secondary-button:hover {
    background-color: #efefef;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style>
