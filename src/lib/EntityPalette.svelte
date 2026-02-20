<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { EntityType, Entity } from './types';

  const entities: Entity[] = [
    { type: 'snake', name: 'Snake', spriteId: 'SnakeHead' },
    { type: 'obstacle', name: 'Obstacle', spriteId: 'Obstacle' },
    { type: 'food', name: 'Food', spriteId: 'Food' },
    { type: 'exit', name: 'Exit', spriteId: 'Exit' },
    { type: 'stone', name: 'Stone', spriteId: 'Stone' },
    { type: 'spike', name: 'Spike', spriteId: 'Spike' },
    { type: 'floating-food', name: 'Floating Food', spriteId: 'FloatingFood' },
    { type: 'falling-food', name: 'Falling Food', spriteId: 'FallingFood' },
  ];

  let selectedEntity: EntityType = 'snake';

  const dispatch = createEventDispatcher<{ select: EntityType }>();
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function selectEntity(entityType: EntityType) {
    selectedEntity = entityType;
    dispatch('select', entityType);
  }

  function createDragImage(spriteId: string): HTMLDivElement {
    const dragImage = document.createElement('div');
    dragImage.style.width = '32px';
    dragImage.style.height = '32px';
    dragImage.style.backgroundColor = '#ffffff';
    dragImage.style.borderRadius = '6px';
    dragImage.style.padding = '2px';
    dragImage.style.border = '1px solid #ddd';
    dragImage.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('width', '28');
    svg.setAttribute('height', '28');

    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#${spriteId}`);
    svg.appendChild(use);

    dragImage.appendChild(svg);
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';

    return dragImage;
  }

  function handleDragStart(event: DragEvent, entityType: EntityType) {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('entityType', entityType);

      // Create a custom drag image with the entity sprite
      const entity = entities.find(e => e.type === entityType);
      if (entity) {
        const dragImage = createDragImage(entity.spriteId);
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 16, 16);

        // Clean up the drag image after drag operation
        setTimeout(() => dragImage.remove(), 0);
      }
    }
  }
</script>

<div class="entity-palette">
  {#each entities as entity (entity.type)}
    <button
      class="entity-item"
      class:selected={selectedEntity === entity.type}
      draggable="true"
      on:click={() => selectEntity(entity.type)}
      on:dragstart={(e) => handleDragStart(e, entity.type)}
    >
      <svg class="entity-icon" viewBox="0 0 32 32" aria-hidden="true">
        <use href="#{entity.spriteId}" />
      </svg>
      <span class="entity-name">{entity.name}</span>
    </button>
  {/each}
</div>

<style>
  .entity-palette {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .entity-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background-color: #fff;
    border: 2px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    font-size: 14px;
  }

  .entity-item:hover {
    background-color: #f0f0f0;
  }

  .entity-item.selected {
    border-color: #4caf50;
    background-color: #f5f5f5;
  }

  .entity-item:active {
    transform: scale(0.95);
  }

  .entity-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .entity-name {
    flex: 1;
    font-weight: 500;
  }
</style>
