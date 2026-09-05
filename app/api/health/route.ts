import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { checkoutOrders } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    const database = getDb();

    await database
      .select({ id: checkoutOrders.id })
      .from(checkoutOrders)
      .limit(1);

    return NextResponse.json({
      application: "healthy",
      database: "connected",
    });
  } catch (error) {
    console.error(
      "[AgentCart] Database health check failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      {
        application: "healthy",
        database: "unavailable",
      },
      { status: 503 },
    );
  }
}