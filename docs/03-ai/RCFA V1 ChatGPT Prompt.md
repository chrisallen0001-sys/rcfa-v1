import { NextResponse } from "next/server";

import { cookies } from "next/headers";

import OpenAI from "openai";

import { verifyToken } from "../auth/route";

const MODEL = process.env.OPENAI_MODEL \|\| "gpt-5.2";

function getClient() {

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  return new OpenAI({ apiKey });

}

function buildPrompt(body: any) {

  return \`

You are an expert reliability engineer performing an RCFA.

Return ONLY valid JSON (no markdown, no extra text) with exactly these keys:

\- followUpQuestions: string\[\]

\- rootCauseContenders: { cause: string; rationale: string; confidence: "low"\|"medium"\|"high" }\[\]

\- actionItems: { action: string; owner: string; priority: "P1"\|"P2"\|"P3"; timeframe: "Immediate"\|"Short-term"\|"Long-term"; successCriteria: string }\[\]

Rules:

\- 5–10 followUpQuestions

\- 3–6 rootCauseContenders

\- 5–10 actionItems

\- If info is missing, ask follow-up questions rather than inventing specifics.

RCFA INTAKE

Equipment Description: \${body?.equipmentDescription \|\| ""}

Make: \${body?.make \|\| ""}

Model: \${body?.model \|\| ""}

Serial Number: \${body?.serialNumber \|\| ""}

Age (years): \${body?.age \|\| ""}

Work History: \${body?.workHistory \|\| ""}

Active PMs: \${body?.activePMs \|\| ""}

Pre-Failure Conditions: \${body?.preFailure \|\| ""}

Failure Description: \${body?.failureDescription \|\| ""}

Additional Notes: \${body?.additionalNotes \|\| ""}

\`.trim();

}

function tryParseJson(text: string): any {

  return JSON.parse(text.trim());

}

export async function POST(req: Request) {

  console.log("Has key?", Boolean(process.env.OPENAI_API_KEY));

  try {

    // Verify authentication token

    const cookieStore = await cookies();

    const token = cookieStore.get("auth_token")?.value;

    const tokenSecret = process.env.AUTH_TOKEN_SECRET;

    if (!tokenSecret) {

      return NextResponse.json(

        { error: "Server configuration error" },

        { status: 500 }

      );

    }

    if (!token \|\| !verifyToken(token, tokenSecret)) {

      return NextResponse.json(

        { error: "Unauthorized. Please log in again." },

        { status: 401 }

      );

    }

    if (!process.env.OPENAI_API_KEY) {

      return NextResponse.json(

        { error: "Missing OPENAI_API_KEY in .env.local" },

        { status: 500 }

      );

    }

    const client = getClient();

    const body = await req.json();

    if (!body?.equipmentDescription \|\| !body?.failureDescription) {

      return NextResponse.json(

        { error: "equipmentDescription and failureDescription are required." },

        { status: 400 }

      );

    }

    const prompt = buildPrompt(body);

    // 1) First attempt

    const r1 = await client.responses.create({

      model: MODEL,

      input: prompt,

      temperature: 0.2,

    });

    const t1 = r1.output_text \|\| "";

    try {

      const json = tryParseJson(t1);

      return NextResponse.json(json);

    } catch (e1: any) {

      // 2) One retry: ask model to fix JSON only

      const r2 = await client.responses.create({

        model: MODEL,

        input: \[

          { role: "user", content: prompt },

          {

            role: "user",

            content:

              "Your previous response was not valid JSON. Return ONLY valid JSON matching the required keys and enums. No extra text.",

          },

        \],

        temperature: 0.2,

      });

      const t2 = r2.output_text \|\| "";

      const json2 = tryParseJson(t2);

      return NextResponse.json(json2);

    }

  } catch (err: any) {

    return NextResponse.json(

      { error: "OpenAI request failed", details: err?.message \|\| String(err) },

      { status: 500 }

    );

  }

}
