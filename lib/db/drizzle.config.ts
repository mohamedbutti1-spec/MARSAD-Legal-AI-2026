import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// In development the URL carries ?sslmode=disable (local helium DB).
// In production Replit's PostgreSQL requires SSL; rejectUnauthorized:false
// is needed because the server uses a self-signed cert.
const sslDisabled = process.env.DATABASE_URL.includes("sslmode=disable");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
  },
});
