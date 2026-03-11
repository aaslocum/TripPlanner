import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import passport from 'passport';
import config from './config/env.js';
import { configurePassport } from './config/passport.js';
import { getDb, saveDb } from './db/connection.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import userRoutes from './routes/users.js';
import accommodationRoutes from './routes/accommodations.js';
import bedroomRoutes from './routes/bedrooms.js';
import bedRoutes from './routes/beds.js';
import activityRoutes from './routes/activities.js';
import imageRoutes from './routes/images.js';
import scrapeRoutes from './routes/scrape.js';
import bedroomClaimRoutes from './routes/bedroomClaims.js';
import proposalRoutes from './routes/proposals.js';
import agentRoutes from './routes/agent.js';
import aiSettingsRoutes from './routes/ai-settings.js';
import transportationRoutes from './routes/transportation.js';
import eatsRoutes from './routes/eats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// Initialize DB and Passport
await getDb();
configurePassport();
app.use(passport.initialize());

// Save DB after each mutation request
app.use((req, res, next) => {
  const original = res.json.bind(res);
  res.json = (body) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      saveDb();
    }
    return original(body);
  };
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/users', userRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/bedrooms', bedroomRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/scrape', scrapeRoutes);
app.use('/api/bedroom-claims', bedroomClaimRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/ai-settings', aiSettingsRoutes);
app.use('/api/trips/:tripId/transportation', transportationRoutes);
app.use('/api/eats', eatsRoutes);

// Serve client in production
if (config.nodeEnv === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`Auth bypass: ${config.authBypass ? 'ENABLED' : 'disabled'}`);
});
