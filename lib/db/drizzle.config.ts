import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// In development the URL carries ?sslmode=disable (local helium DB).
// In production Railway/PostgreSQL may require SSL; rejectUnauthorized:false
// supports managed/self-signed certificates.
const sslDisabled = process.env.DATABASE_URL.includes("sslmode=disable");

export default defineConfig({
  // Point Drizzle directly at every schema module. This avoids relying on
  // re-export discovery through index.ts in non-interactive production builds.
  schema: path.join(__dirname, "./src/schema/*.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
  },
});
