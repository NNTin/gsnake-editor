import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Enable CORS for localhost development (allow all localhost ports)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all localhost origins
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// In-memory storage for test level
interface StoredLevel {
  data: any;
  timestamp: number;
}

let testLevel: StoredLevel | null = null;

// Expiration time: 1 hour in milliseconds
const EXPIRATION_TIME = 60 * 60 * 1000;

// Helper function to check if level has expired
function isLevelExpired(level: StoredLevel): boolean {
  return Date.now() - level.timestamp > EXPIRATION_TIME;
}

// POST /api/test-level - Store a test level
app.post('/api/test-level', (req, res) => {
  const levelData = req.body;

  if (!levelData) {
    return res.status(400).json({ error: 'No level data provided' });
  }

  // Store the level with current timestamp
  testLevel = {
    data: levelData,
    timestamp: Date.now()
  };

  console.log('Test level stored successfully');
  res.json({ success: true, message: 'Test level stored successfully' });
});

// GET /api/test-level - Retrieve the stored test level
app.get('/api/test-level', (req, res) => {
  if (!testLevel) {
    return res.status(404).json({ error: 'No test level available' });
  }

  // Check if level has expired
  if (isLevelExpired(testLevel)) {
    testLevel = null;
    return res.status(404).json({ error: 'Test level has expired' });
  }

  res.json(testLevel.data);
});

// Export app for testing
export { app };

// Start the server only when run directly (not when imported for testing)
// Check if this module is the main entry point
const isMainModule = import.meta.url.endsWith(process.argv[1]) ||
                     import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Test level server running on http://localhost:${PORT}`);
    console.log('Endpoints:');
    console.log(`  POST http://localhost:${PORT}/api/test-level`);
    console.log(`  GET  http://localhost:${PORT}/api/test-level`);
  });
}
