<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import toast from 'svelte-5-french-toast';

  const dispatch = createEventDispatcher<{
    cancel: void;
    export: { name: string; difficulty: 'easy' | 'medium' | 'hard' };
  }>();

  export let snakeCount: number = 0;
  export let foodCount: number = 0;
  export let hasExit: boolean = false;

  let name = '';
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';

  // Calculate validation warnings
  $: warnings = [
    snakeCount === 0 ? 'No snake placed - level is invalid' : null,
    foodCount === 0 ? 'No food placed - level may not be completable' : null,
    !hasExit ? 'No exit placed - level cannot be completed' : null,
  ].filter(w => w !== null) as string[];

  $: hasWarnings = warnings.length > 0;

  function handleCancel() {
    dispatch('cancel');
  }

  function handleExport() {
    // Validate inputs
    if (!name.trim()) {
      toast.error('Level name is required', {
        duration: 5000,
        style: 'background: #fff3cd; color: #856404; border-left: 4px solid #ffc107; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
      });
      return;
    }

    if (!difficulty) {
      toast.error('Difficulty is required', {
        duration: 5000,
        style: 'background: #fff3cd; color: #856404; border-left: 4px solid #ffc107; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);'
      });
      return;
    }

    dispatch('export', { name: name.trim(), difficulty });
  }
</script>

<div class="modal-overlay">
  <div class="modal">
    <h2>Save Level</h2>
    <p class="description">Provide level metadata before exporting</p>

    <div class="form-group">
      <label for="name">Level Name</label>
      <input
        id="name"
        type="text"
        bind:value={name}
        placeholder="Enter level name"
        required
      />
    </div>

    <div class="form-group">
      <label for="difficulty">Difficulty</label>
      <select
        id="difficulty"
        bind:value={difficulty}
        required
      >
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
    </div>

    <div class="info-box">
      <span class="info-icon">ℹ️</span>
      Level ID will be auto-generated
    </div>

    {#if hasWarnings}
      <div class="warning-box">
        <span class="warning-icon">⚠️</span>
        <div class="warning-content">
          <strong>Validation Warnings:</strong>
          <ul>
            {#each warnings as warning (warning)}
              <li>{warning}</li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}

    <div class="button-group">
      <button class="secondary-button" on:click={handleCancel}>
        Cancel
      </button>
      <button class="primary-button" on:click={handleExport}>
        {hasWarnings ? 'Export Anyway' : 'Export'}
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

  input,
  select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: #4caf50;
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
  }

  select {
    cursor: pointer;
  }

  .info-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: #e3f2fd;
    border-left: 3px solid #2196f3;
    border-radius: 4px;
    font-size: 0.9rem;
    color: #1565c0;
    margin-bottom: 1.5rem;
  }

  .info-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .warning-box {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: #fff3cd;
    border-left: 3px solid #ffc107;
    border-radius: 4px;
    font-size: 0.9rem;
    color: #856404;
    margin-bottom: 1.5rem;
  }

  .warning-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .warning-content {
    flex: 1;
  }

  .warning-content strong {
    display: block;
    margin-bottom: 0.5rem;
  }

  .warning-content ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .warning-content li {
    margin-bottom: 0.25rem;
  }

  .warning-content li:last-child {
    margin-bottom: 0;
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
