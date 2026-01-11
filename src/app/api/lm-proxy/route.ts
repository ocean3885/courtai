import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LM_STUDIO_BASE_URL = 'http://211.115.183.208:1234/v1';

export async function GET() {
    try {
        console.log(`Checking connection to: ${LM_STUDIO_BASE_URL}/models`);
        // Check models endpoint for a quick health check
        const response = await fetch(`${LM_STUDIO_BASE_URL}/models`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // Set a short timeout for connection check
            // @ts-ignore
            signal: AbortSignal.timeout(3000),
            cache: 'no-store' // Ensure no caching
        });

        console.log(`Connection check status: ${response.status}`);
        if (response.ok) {
            return NextResponse.json({ status: 'connected' });
        } else {
            return NextResponse.json({ status: 'disconnected', error: response.statusText }, { status: 503 });
        }
    } catch (error: any) {
        console.error('Connection check error:', error.message);
        return NextResponse.json({ status: 'disconnected', error: error.message }, { status: 503 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const response = await fetch(`${LM_STUDIO_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...body,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `LM Studio API error: ${response.status} ${errorText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error in LM Proxy:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
