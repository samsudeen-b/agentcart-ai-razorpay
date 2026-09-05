import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = neon(databaseUrl);

  return drizzle({
    client,
    schema,
  });
}

let database:
  | ReturnType<typeof createDatabase>
  | undefined;

export function getDb() {
  database ??= createDatabase();
  return database;
}