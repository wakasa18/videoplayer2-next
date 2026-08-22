import { NextResponse } from "next/server";

import { getOwnerShareAnalytics } from "@/lib/shares/data";
import { shareErrorResponse, ShareRequestError } from "@/lib/shares/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const id = Number.parseInt((await context.params).id, 10);
    if (!Number.isInteger(id) || id < 1) {
      throw new ShareRequestError("Invalid shared-link identifier.");
    }
    return NextResponse.json(await getOwnerShareAnalytics(id));
  } catch (error) {
    return shareErrorResponse(error);
  }
}
