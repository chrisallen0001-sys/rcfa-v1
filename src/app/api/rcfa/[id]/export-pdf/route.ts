import React from "react";
import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { fetchRcfaById } from "@/lib/rcfa-queries";
import { formatRcfaNumber } from "@/lib/rcfa-utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    try {
      await getAuthContext();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid RCFA id" }, { status: 400 });
    }

    const rcfa = await fetchRcfaById(id);
    if (!rcfa) {
      return NextResponse.json({ error: "RCFA not found" }, { status: 404 });
    }

    // Dynamically import react-pdf to avoid bundling issues with client-side code.
    // Also dynamically import the PDF document component.
    const reactPdf = await import("@react-pdf/renderer");
    const { RcfaPdfDocument } = await import("@/lib/pdf/RcfaPdfDocument");

    // react-pdf's renderToBuffer expects ReactElement<DocumentProps>, but the
    // component wraps <Document> internally. The type assertion is necessary
    // because react-pdf's strict typing expects the Document element directly.
    const element = React.createElement(RcfaPdfDocument, { rcfa });
    // NOTE: For very large RCFAs, consider switching to reactPdf.renderToStream
    // to avoid buffering the entire PDF in memory.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await reactPdf.renderToBuffer(element as any);

    const filename = `${formatRcfaNumber(rcfa.rcfaNumber)}-report.pdf`;

    // Convert Node.js Buffer to Uint8Array for the Web Response constructor.
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/rcfa/[id]/export-pdf error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
