# gSnake Level Editor

A level editor for creating custom gSnake levels, built with Svelte + TypeScript + Vite.

## Configuration

### Environment Variables

- **VITE_GSNAKE_WEB_URL**: URL of the gsnake-web game interface for testing levels
  - Default: `http://localhost:3000`
  - Set this to test against a different backend (e.g., production deploy, staging)
  - Example: `VITE_GSNAKE_WEB_URL=https://gsnake.example.com npm run dev`

Create a `.env` file in the gsnake-editor directory to customize (see `.env.example`):
```bash
VITE_GSNAKE_WEB_URL=http://localhost:3000
```

## Getting Started

### Development

To start the development server (runs both the editor UI and backend server):

```bash
npm run dev
```

This will start:
- Editor UI on http://localhost:5173
- Backend server on http://localhost:3000

### Individual Commands

If you need to run services separately:

```bash
npm run dev:editor  # Start only the editor UI (Vite)
npm run dev:server  # Start only the backend server
```

### Other Commands

```bash
npm run build    # Build for production
npm run preview  # Preview production build
npm run check    # Run TypeScript type checking
```

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

## CI/CD

This submodule has its own GitHub Actions workflow at `.github/workflows/ci.yml` to validate standalone builds.

### Testing CI Locally with nektos/act

You can test the CI workflow locally using [nektos/act](https://github.com/nektos/act):

```bash
# Install act (if not already installed)
# Ubuntu/Debian: sudo apt install act
# macOS: brew install act

# Test the build job
cd gsnake-editor
act -j build

# Test the typecheck job
act -j typecheck

# List all available jobs
act -l
```

**Note:** act requires Docker and uses it to simulate GitHub Actions runners. On first run, it will prompt you to select a Docker image size (recommend the medium image: `ghcr.io/catthehacker/ubuntu:act-latest`).

**Known Limitations:**
- Cache actions may not work exactly as on GitHub Actions
- `workflow_dispatch` trigger cannot be tested locally with act
- Network operations may behave differently than on actual GitHub runners

