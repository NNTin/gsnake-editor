# Git Hooks for gsnake-editor

This directory contains shared git hooks for the gsnake-editor repository.

## Enabling Hooks

To enable these hooks, run from the gsnake-editor directory:

```bash
git config core.hooksPath .github/hooks
```

## Verification

Verify that hooks are enabled:

```bash
git config core.hooksPath
```

This should output: `.github/hooks`

## Disabling Hooks

To disable the hooks and revert to default behavior:

```bash
git config --unset core.hooksPath
```

## Available Hooks

### pre-commit

The pre-commit hook runs the following checks:

1. **Format Check**: `npm run format:check` (prettier --check)
2. **Linter**: `npm run lint` (eslint)
3. **Type Check**: `npm run check` (svelte-check)
4. **Build**: `npm run build` (vite build)

**Note: Tests are NOT run in pre-commit hooks for speed.** Run tests manually with `npm test` before pushing.
