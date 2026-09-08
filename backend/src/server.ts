import express from 'express';
import { config } from './config/env.js';
import { configureCors } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

const app = express();

// Middlewares
app.use(configureCors());
app.use(express.json());

// Routes
app.use('/', routes);

// Error Handling
app.use(errorHandler);

// Start Server
app.listen(config.port, () => {
  console.log(`[Smart Canteen Backend] Server running on http://localhost:${config.port}`);
  console.log(`[Smart Canteen Backend] Environment: ${config.nodeEnv}`);
});
