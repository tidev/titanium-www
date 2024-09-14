import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // dbCredentials: {
  //   url: 'process.env.NEON_CONNECTION_STRING,'
  // },
  dialect: 'postgresql',
  migrations: {
    schema: 'public',
    table: '__drizzle_migrations',
  },
  out: './drizzle',
  schema: 'src/db-schemas/*',
  strict: true,
  verbose: true,
});