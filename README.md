# gSnake Level Editor

Svelte + TypeScript level editor for gSnake.

The editor now consumes shared art/style primitives from `gsnake-web-ui` so visuals stay synchronized with `gsnake-web`.

## Shared UI Dependency Modes

`npm install` runs `scripts/detect-gsnake-web-ui.js` (`preinstall`) and auto-switches dependency source:

- Root repository mode:
  - dependency: `file:../gsnake-web/packages/gsnake-web-ui`
  - used when `../.git` and `../gsnake-web/packages/gsnake-web-ui/package.json` are present
- Standalone mode:
  - dependency: `file:./vendor/gsnake-web-ui`
  - script downloads a snapshot archive from `NNTin/gsnake-web` `main`, extracts `packages/gsnake-web-ui`, then builds it locally for precompiled consumption

Set `FORCE_GIT_DEPS=1` to force standalone mode (used by CI).

## Environment Variables

- `VITE_GSNAKE_WEB_URL` - target URL for test-level launch flow
  - default: `http://localhost:3000`
- `GSNAKE_EDITOR_ALLOWED_ORIGINS` - comma-separated exact origins allowed by editor API CORS
  - default: `http://localhost:3000,http://127.0.0.1:3000,http://localhost:3003,http://127.0.0.1:3003`

Example `.env`:

```bash
VITE_GSNAKE_WEB_URL=http://localhost:3000
GSNAKE_EDITOR_ALLOWED_ORIGINS=http://localhost:3003,http://localhost:3000
```

## Install and Run

```bash
npm install
npm run dev
```

This starts:

- editor UI: `http://localhost:3003`
- editor API: `http://localhost:3001`

## Commands

```bash
npm run dev:editor
npm run dev:server
npm run build
npm run check
npm test
npm run coverage
```

## Health Endpoints

- `GET http://localhost:3001/health` (editor API) returns:

```json
{
  "status": "ok",
  "service": "gsnake-editor-api"
}
```

- `GET http://localhost:3003/health` (editor UI dev server) returns plain text:

```text
gsnake-editor-ui:ok
```

## Test-Level API Validation

`POST /api/test-level` validates payloads against `contracts/level-definition.schema.json`.

Invalid payloads return:

```json
{
  "error": "Invalid level payload",
  "details": [
    {
      "field": "gridSize.width",
      "keyword": "type",
      "message": "must be integer"
    }
  ]
}
```

## Shared Art Style Notes

The editor imports shared styles/assets/components from `gsnake-web-ui`:

- shared light theme baseline
- shared sprites for palette/grid visuals
- shared `Modal` and `Overlay` base components

When changing shared UI contracts in `gsnake-web-ui`, update `gsnake-editor` in one atomic migration so mixed-theme/mixed-component states are avoided.

### Sprite Trust Boundary

`src/lib/SpriteLoader.svelte` treats `spritesUrl` as a trusted internal asset source and enforces guardrails before mounting sprite markup:

- fetch response must be `2xx`
- `content-type` must include `image/svg+xml`
- sprite content is parsed as SVG and sanitized before insertion
  - blocked nodes: `script`, `foreignObject`, `iframe`, `object`, `embed`
  - blocked attributes: inline event handlers (`on*`), `style`, `javascript:` URL values, and non-fragment `href`/`xlink:href`

If the payload fails validation, sprite definitions are not mounted and an error is logged.

## CI

`.github/workflows/ci.yml` runs in standalone mode (`FORCE_GIT_DEPS=1`) to validate vendored snapshot install/build/test behavior.
