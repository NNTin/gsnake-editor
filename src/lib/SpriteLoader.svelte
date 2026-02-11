<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { spritesUrl } from "gsnake-web-ui";

  let spriteContent = "";

  onMount(async () => {
    const response = await fetch(spritesUrl);
    spriteContent = await response.text();
  });

  onDestroy(() => {
    spriteContent = "";
  });
</script>

{#if spriteContent}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html spriteContent}
{/if}
