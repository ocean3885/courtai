import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// 사용자 인증 유틸리티
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

export async function GET(req: NextRequest) {
    const userId = await getUserId(req);
    if (!userId) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    try {
        const results = db.prepare(`
            SELECT id, title, memo, status, created_at, updated_at 
            FROM rehabilitation_results 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `).all(userId);

        return NextResponse.json({ success: true, data: results });
    } catch (error: any) {
        console.error('Fetch results error:', error);
        return NextResponse.json({ error: '목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const userId = await getUserId(req);
    if (!userId) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    try {
        const { title, creditor_data, plan_data, memo } = await req.json();

        if (!title) {
            return NextResponse.json({ error: '제목(사건번호)이 필요합니다.' }, { status: 400 });
        }

        const result = db.prepare(`
            INSERT INTO rehabilitation_results (user_id, title, creditor_data, plan_data, memo)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, title, creditor_data, plan_data, memo);

        return NextResponse.json({ success: true, id: result.lastInsertRowid });
    } catch (error: any) {
        console.error('Save result error:', error);
        return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
