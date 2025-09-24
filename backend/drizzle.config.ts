import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv-flow';

config();

export default defineConfig({
  schema:
    process.env.NODE_ENV === 'production'
      ? './dist/db/schema.js'
      : './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
