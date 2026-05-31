import { NextResponse } from "next/server";
import { executeGreeting } from "@/convex/ai";

const FALLBACKS = [
  "What are you working on today?",
  "Ready when you are.",
  "Let's make progress.",
  "What's on your mind?",
  "Your workspace is ready.",
  "Small steps compound. What's the next one?",
  "Momentum beats perfection.",
  "What does done look like today?",
];

function pickFallback() {
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

export async function GET() {
  try {
    const result = await executeGreeting();
    const text = result.content.trim();

    if (!text || text.length > 80) {
      return NextResponse.json({ greeting: pickFallback() });
    }

    // Strip any leading/trailing quotes the model might add
    const cleaned = text.replace(/^["']+|["']+$/g, "").trim();

    return NextResponse.json(
      { greeting: cleaned || pickFallback() },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json({ greeting: pickFallback() });
  }
}
