import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getUserId(request: NextRequest): number | null {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        return decoded.id;
    } catch (error) {
        return null;
    }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = getUserId(request);
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { id } = await params;
        const list = db.prepare(`
            SELECT * FROM creditor WHERE id = ? AND user_id = ?
        `).get(id, userId);

        if (!list) return NextResponse.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 });

        return NextResponse.json({
            ...list,
            data: JSON.parse((list as any).data)
        });
    } catch (error) {
        return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = getUserId(request);
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { id } = await params;
        const { title, data } = await request.json();

        db.prepare(`
            UPDATE creditor 
            SET title = ?, data = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `).run(title, JSON.stringify(data), id, userId);

        return NextResponse.json({ success: true, message: '수정되었습니다.' });
    } catch (error) {
        return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = getUserId(request);
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { id } = await params;
        db.prepare(`DELETE FROM creditor WHERE id = ? AND user_id = ?`).run(id, userId);

        return NextResponse.json({ success: true, message: '삭제되었습니다.' });
    } catch (error) {
        return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
