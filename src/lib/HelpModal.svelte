<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  function handleClose() {
    dispatch('close');
  }

  // Keyboard shortcuts data
  const shortcuts = [
    { keys: 'Ctrl+Z / Cmd+Z', description: 'Undo last action' },
    { keys: 'Ctrl+Y / Cmd+Shift+Z', description: 'Redo last action' },
    { keys: 'Shift+Click', description: 'Remove entity from cell' },
    { keys: 'Esc', description: 'Close modal/cancel' }
  ];

  // Handle Escape key to close modal
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="modal-overlay">
  <div class="modal">
    <h2>Keyboard Shortcuts</h2>
    <p class="description">Use these shortcuts to work more efficiently</p>

    <div class="shortcuts-list">
      {#each shortcuts as shortcut}
        <div class="shortcut-item">
          <kbd class="shortcut-keys">{shortcut.keys}</kbd>
          <span class="shortcut-description">{shortcut.description}</span>
        </div>
      {/each}
    </div>

    <div class="button-group">
      <button class="primary-button" on:click={handleClose}>
        Close
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background-color: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    min-width: 400px;
  }

  h2 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1.5rem;
  }

  .description {
    margin: 0 0 1.5rem 0;
    color: #666;
    font-size: 0.9rem;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background-color: #f9f9f9;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
  }

  .shortcut-keys {
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.4rem 0.6rem;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.1);
    color: #333;
    white-space: nowrap;
    min-width: 140px;
    text-align: center;
  }

  .shortcut-description {
    color: #555;
    font-size: 0.95rem;
  }

  .button-group {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .primary-button {
    flex: 1;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    background-color: #4caf50;
    color: white;
  }

  .primary-button:hover {
    background-color: #45a049;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
  }
</style>
