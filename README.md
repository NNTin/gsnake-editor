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

## Standalone Build

This editor can build independently without requiring `gsnake-web` as a sibling repository.

### Prerequisites

- Node.js 18+ and npm
- A running gsnake-web instance (for integration testing)

### Installation

```bash
npm install
```

### Building

```bash
npm run build    # Build for production
npm run preview  # Preview production build
npm run check    # Run TypeScript type checking and linting
npm test         # Run unit tests
```

## Getting Started

### Development

To start the development server (runs both the editor UI and backend server):

```bash
npm run dev
```

This will start:
- Editor UI on http://localhost:3003
- Backend server on http://localhost:3001

### Individual Commands

If you need to run services separately:

```bash
npm run dev:editor  # Start only the editor UI (Vite)
npm run dev:server  # Start only the backend server
```

## Testing

### Unit Tests

Unit tests verify core functionality and can run independently:

```bash
npm test           # Run all tests once
npm run test:watch # Run tests in watch mode
npm run test:ui    # Open Vitest UI
```

### Integration Tests

To test the editor against gsnake-web, you need a running gsnake-web instance:

**Option 1: Run gsnake-web locally**
```bash
# In the gsnake-web directory (if working in root repo)
cd ../gsnake-web
npm install
npm run dev  # Starts on http://localhost:3000

# Then run editor tests
cd ../gsnake-editor
npm test
```

**Option 2: Set VITE_GSNAKE_WEB_URL to point to a remote instance**
```bash
VITE_GSNAKE_WEB_URL=https://gsnake.example.com npm test
```

If gsnake-web is unreachable, integration tests will be skipped with a warning message. Unit tests will still run and pass.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

## Troubleshooting

### Integration tests are skipped

**Problem:** Integration tests show "gsnake-web is not reachable, skipping integration tests" warning.

**Cause:** The gsnake-web service is not running or not accessible at VITE_GSNAKE_WEB_URL.

**Solution:**
- Start gsnake-web locally: `cd ../gsnake-web && npm run dev`
- Or set VITE_GSNAKE_WEB_URL to point to a running instance
- Or skip integration tests and only run unit tests (unit tests will still pass)

### Build fails with module resolution errors

**Problem:** TypeScript cannot find type definitions or modules.

**Cause:** Dependencies not installed or incorrect Node.js version.

**Solution:**
```bash
# Ensure Node.js 18+ is installed
node --version

# Clean install dependencies
rm -rf node_modules package-lock.json
npm install
```

### Development server won't start

**Problem:** `npm run dev` fails with port already in use.

**Cause:** Another process is using port 3003 or 3001.

**Solution:**
```bash
# Find and kill process using the port
# On Linux/macOS:
lsof -ti:3003 | xargs kill
lsof -ti:3001 | xargs kill

# Or change the port in vite.config.ts or server.ts
```

### Type checking fails

**Problem:** `npm run check` reports type errors.

**Cause:** TypeScript configuration or code issues.

**Solution:**
- Check that all dependencies are installed: `npm install`
- Verify TypeScript version matches project requirements
- Review the specific error messages and fix type issues in your code

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

