import { NextRequest, NextResponse } from "next/server";


const ALLOWED_HOSTS = [
    "media.tenor.com",
    "tenor.googleapis.com",
    "api.tenor.com",
]

function makeMsgResponse(msg: string, status: number) { return new Response(msg, { status: status }) }

export async function GET(req: NextRequest) {
    // A proxy to download things (like GIFs) on the frontend

    const url = req.nextUrl.searchParams.get("url")
    if (!url) return makeMsgResponse("Missing URL parameter.", 400)

    try {
        const parsed = new URL(url)
        if (!ALLOWED_HOSTS.includes(parsed.host)) return makeMsgResponse(`Forbidden: Host not allowed`, 403)

        const response = await fetch(url)
        if (!response.ok) return makeMsgResponse("Failed to fetch file", 502)

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const data = await response.arrayBuffer();

        return new NextResponse(data, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                // "Access-Control-Allow-Origin": "*", // TODO: FIX THIS, IT SHOULD NOT BE *
                "Content-Disposition": `inline; filename="file.${contentType.split("/")[1] || "bin"}"`,
            },
        });

    } catch (err) {
        console.error("Proxy request failed:", err);
        return new NextResponse("Error fetching file", { status: 500 });

    }
    
}