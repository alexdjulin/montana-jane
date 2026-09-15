import { NextResponse } from "next/server";

/**
 * Server-side credit check. FAL_KEY never reaches the browser — the key is read
 * here and only the resulting number is returned.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.FAL_KEY;
  if (!key) {
    return NextResponse.json({ error: "FAL_KEY is not set on the server" }, { status: 500 });
  }

  try {
    const res = await fetch("https://rest.fal.ai/billing/user_balance", {
      headers: { Authorization: `Key ${key}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `fal billing returned ${res.status}` },
        { status: 502 },
      );
    }

    // the endpoint answers with a bare number, e.g. 49.84328072
    const balance = Number((await res.text()).trim());
    if (!Number.isFinite(balance)) {
      return NextResponse.json({ error: "unparseable balance" }, { status: 502 });
    }

    return NextResponse.json({ balance });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "balance lookup failed" },
      { status: 502 },
    );
  }
}
