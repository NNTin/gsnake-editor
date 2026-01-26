<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    cancel: void;
    create: { width: number; height: number };
  }>();

  let width = 15;
  let height = 15;

  function handleCancel() {
    dispatch('cancel');
  }

  function handleCreate() {
    // Validate inputs
    if (width < 5 || width > 50 || height < 5 || height > 50) {
      alert('Width and height must be between 5 and 50');
      return;
    }

    dispatch('create', { width, height });
  }
</script>

<div class="modal-overlay">
  <div class="modal">
    <h2>Create New Level</h2>
    <p class="description">Specify the grid dimensions for your level</p>

    <div class="form-group">
      <label for="width">Width</label>
      <input
        id="width"
        type="number"
        bind:value={width}
        min="5"
        max="50"
        required
      />
    </div>

    <div class="form-group">
      <label for="height">Height</label>
      <input
        id="height"
        type="number"
        bind:value={height}
        min="5"
        max="50"
        required
      />
    </div>

    <div class="button-group">
      <button class="secondary-button" on:click={handleCancel}>
        Cancel
      </button>
      <button class="primary-button" on:click={handleCreate}>
        Create
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

  .form-group {
    margin-bottom: 1.25rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    color: #333;
    font-weight: 500;
    font-size: 0.9rem;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: #4caf50;
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
  }

  .button-group {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .primary-button,
  .secondary-button {
    flex: 1;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
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
