import { defineConfig } from "drizzle-kit";
import path from "path";
import dotenv from "dotenv";

// Load root project .env
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Check your root .env file."
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});