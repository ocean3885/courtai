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

export async function GET(request: NextRequest) {
    try {
        const userId = getUserId(request);
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const lists = db.prepare(`
            SELECT id, title, data, created_at, updated_at
            FROM creditor
            WHERE user_id = ?
            ORDER BY updated_at DESC
        `).all(userId);

        const formattedLists = lists.map((l: any) => {
            // 각 creditor에 연결된 documents 조회
            const documents = db.prepare(`
                SELECT id, title, created_at
                FROM case_documents
                WHERE creditor_id = ?
                ORDER BY created_at DESC
            `).all(l.id);

            return {
                ...l,
                data: JSON.parse(l.data),
                documents: documents || [],
            };
        });

        return NextResponse.json(formattedLists);
    } catch (error) {
        console.error('Creditor list fetch error:', error);
        return NextResponse.json({ error: '목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = getUserId(request);
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { title, data } = await request.json();
        if (!title || !data) return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });

        const insert = db.prepare(`
            INSERT INTO creditor (user_id, title, data)
            VALUES (?, ?, ?)
        `);

        const result = insert.run(userId, title, JSON.stringify(data));

        return NextResponse.json({
            success: true,
            id: result.lastInsertRowid,
            message: '저장되었습니다.',
        });
    } catch (error) {
        console.error('Creditor list save error:', error);
        return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
