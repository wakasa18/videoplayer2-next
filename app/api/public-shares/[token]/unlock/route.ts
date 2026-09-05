import { NextResponse } from "next/server";

import { shareErrorResponse, verifyPublicSharePassword } from "@/lib/shares/server";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const token = (await context.params).token;
    const body = (await request.json()) as { password?: unknown };
    const password = String(body.password ?? "");
    const proof = await verifyPublicSharePassword(token, password);
    const response = NextResponse.json({ success: true });
    response.cookies.set(proof.cookieName, proof.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch (error) {
    return shareErrorResponse(error);
  }
}
