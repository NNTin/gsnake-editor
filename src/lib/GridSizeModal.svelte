<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Modal } from 'gsnake-web-ui';
  import toast from 'svelte-5-french-toast';

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
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 5 || width > 50 || height < 5 || height > 50) {
      toast.error('Width and height must be whole numbers between 5 and 50', {
        duration: 5000,
        style: 'background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
      });
      return;
    }

    dispatch('create', { width, height });
  }
</script>

<Modal open={true} closeOnBackdrop={false}>
  <h2 slot="header" class="modal-title">Create New Level</h2>
  <p class="description">Specify the grid dimensions for your level</p>

  <div class="form-group">
    <label for="width">Width</label>
    <input
      id="width"
      type="number"
      bind:value={width}
      min="5"
      max="50"
      step="1"
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
      step="1"
      required
    />
  </div>

  <div slot="footer" class="button-group">
      <button class="secondary-button" on:click={handleCancel}>
        Cancel
      </button>
      <button class="primary-button" on:click={handleCreate}>
        Create
      </button>
  </div>
</Modal>

<style>
  .modal-title {
    margin: 0;
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
    width: 100%;
    justify-content: stretch;
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
