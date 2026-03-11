import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dotenvResult = dotenv.config({ path: path.join(__dirname, '../../.env') });

// dotenv won't overwrite existing env vars — but on Windows some vars may be
// pre-set to empty strings in the system environment, blocking the .env values.
// Patch those through so .env values are used when the env var is empty.
if (dotenvResult.parsed) {
  for (const [key, value] of Object.entries(dotenvResult.parsed)) {
    if (!process.env[key] && value) {
      process.env[key] = value;
    }
  }
}

export default {
  port: parseInt(process.env.PORT || '3000', 10),
  authBypass: process.env.AUTH_BYPASS === 'true',
  jwtSecret: process.env.JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  budgetMasterKey: process.env.BUDGET_ENCRYPTION_MASTER_KEY,
  userContextKey: process.env.USER_CONTEXT_ENCRYPTION_KEY,
  baseUrl: process.env.BASE_URL || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
};
