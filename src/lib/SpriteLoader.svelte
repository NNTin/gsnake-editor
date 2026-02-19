<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { spritesUrl } from "gsnake-web-ui";

  const ALLOWED_SVG_CONTENT_TYPE = "image/svg+xml";
  const BLOCKED_SVG_ELEMENTS = new Set(["script", "foreignobject", "iframe", "object", "embed"]);
  const URL_ATTRIBUTES = new Set(["href", "xlink:href"]);

  let spriteContent = "";

  function sanitizeSvgNode(node: Element): void {
    const tagName = node.tagName.toLowerCase();
    if (BLOCKED_SVG_ELEMENTS.has(tagName)) {
      node.remove();
      return;
    }

    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const lowerValue = value.toLowerCase();

      if (name.startsWith("on") || name === "style" || lowerValue.startsWith("javascript:")) {
        node.removeAttribute(attribute.name);
        continue;
      }

      if (URL_ATTRIBUTES.has(name) && !value.startsWith("#")) {
        node.removeAttribute(attribute.name);
      }
    }

    for (const childNode of [...node.children]) {
      sanitizeSvgNode(childNode);
    }
  }

  async function loadSprites() {
    try {
      const response = await fetch(spritesUrl);
      if (!response.ok) {
        throw new Error(`Unexpected sprites response: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes(ALLOWED_SVG_CONTENT_TYPE)) {
        throw new Error(
          `Unexpected sprites content-type: "${contentType || "missing"}" (expected ${ALLOWED_SVG_CONTENT_TYPE})`
        );
      }

      const spriteText = await response.text();
      const parsedSvg = new DOMParser().parseFromString(spriteText, ALLOWED_SVG_CONTENT_TYPE);
      if (parsedSvg.querySelector("parsererror")) {
        throw new Error("Sprites payload is not valid SVG markup");
      }

      const rootSvg = parsedSvg.documentElement;
      if (rootSvg.tagName.toLowerCase() !== "svg") {
        throw new Error("Sprites payload must have an <svg> root element");
      }

      const sanitizedSpriteRoot = rootSvg.cloneNode(true) as SVGSVGElement;
      sanitizeSvgNode(sanitizedSpriteRoot);
      sanitizedSpriteRoot.setAttribute("aria-hidden", "true");
      sanitizedSpriteRoot.setAttribute("focusable", "false");
      spriteContent = new XMLSerializer().serializeToString(sanitizedSpriteRoot);
    } catch (error) {
      spriteContent = "";
      console.error("Failed to load sprite definitions:", error);
    }
  }

  onMount(async () => {
    await loadSprites();
  });

  onDestroy(() => {
    spriteContent = "";
  });
</script>

{#if spriteContent}
  <div class="sprite-loader" aria-hidden="true">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html spriteContent}
  </div>
{/if}

<style>
  .sprite-loader {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
    pointer-events: none;
  }
</style>
