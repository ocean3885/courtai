import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function getUserId(req: NextRequest) {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
        return decoded.id;
    } catch (e) {
        return null;
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    try {
        const result = db.prepare(`
            SELECT * FROM rehabilitation_results WHERE id = ? AND user_id = ?
        `).get(id, userId);

        if (!result) {
            return NextResponse.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    try {
        const body = await req.json();
        const { memo, status: newStatus, plan_data, creditor_data } = body;

        // 동적 쿼리 생성
        const updates: string[] = [];
        const params: any[] = [];

        if (memo !== undefined) {
            updates.push('memo = ?');
            params.push(memo);
        }
        if (newStatus !== undefined) {
            updates.push('status = ?');
            params.push(newStatus);
        }
        if (plan_data !== undefined) {
            updates.push('plan_data = ?');
            params.push(plan_data);
        }
        if (creditor_data !== undefined) {
            updates.push('creditor_data = ?');
            params.push(creditor_data);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');

        const query = `
            UPDATE rehabilitation_results 
            SET ${updates.join(', ')} 
            WHERE id = ? AND user_id = ?
        `;

        const result = db.prepare(query).run(...params, id, userId);

        if (result.changes === 0) {
            return NextResponse.json({ error: '수정할 권한이 없거나 데이터가 없습니다.' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    try {
        const result = db.prepare(`
            DELETE FROM rehabilitation_results WHERE id = ? AND user_id = ?
        `).run(id, userId);

        if (result.changes === 0) {
            return NextResponse.json({ error: '삭제할 권한이 없거나 데이터가 없습니다.' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
