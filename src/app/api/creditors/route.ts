import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const userId = getUserIdFromRequest(request);
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const lists = (await query(`
            SELECT id, title, data, created_at, updated_at
            FROM creditor
            WHERE user_id = $1
            ORDER BY updated_at DESC
        `, [userId])).rows;

        const formattedLists = await Promise.all(lists.map(async (l: any) => {
            // 각 creditor에 연결된 documents 조회
            const documents = (await query(`
                SELECT id, title, created_at
                FROM case_documents
                WHERE creditor_id = $1
                ORDER BY created_at DESC
            `, [l.id])).rows;

            return {
                ...l,
                data: JSON.parse(l.data),
                documents: documents || [],
            };
        }));

        return NextResponse.json(formattedLists);
    } catch (error) {
        console.error('Creditor list fetch error:', error);
        return NextResponse.json({ error: '목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = getUserIdFromRequest(request);
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { title, data } = await request.json();
        if (!title || !data) return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });

        const result = await query<{ id: number }>(`
            INSERT INTO creditor (user_id, title, data)
            VALUES ($1, $2, $3)
            RETURNING id
        `, [userId, title, JSON.stringify(data)]);

        return NextResponse.json({
            success: true,
            id: result.rows[0].id,
            message: '저장되었습니다.',
        });
    } catch (error) {
        console.error('Creditor list save error:', error);
        return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
