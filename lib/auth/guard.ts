import { NextResponse } from "next/server";

export function requireCredentialsProvider(): NextResponse | null {
  const provider = process.env.AUTH_PROVIDER ?? "credentials";
  if (provider !== "credentials") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
