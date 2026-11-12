import { validateCase, InputError } from '@/lib/case-validation';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const lists = (await query(`
            SELECT c.id, c.title, c.data, c.created_at, c.updated_at,
                   COALESCE(json_agg(json_build_object('id', d.id, 'title', d.title, 'created_at', d.created_at)
                     ORDER BY d.created_at DESC, d.id DESC) FILTER (WHERE d.id IS NOT NULL), '[]'::json) AS documents
            FROM creditor c
            LEFT JOIN case_documents d ON d.creditor_id = c.id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY c.updated_at DESC, c.id DESC
        `, [userId])).rows;
        const formattedLists = lists.map(row => ({ ...row, data: JSON.parse(row.data) }));

        return NextResponse.json(formattedLists);
    } catch (error) {
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        console.error('Creditor list fetch error:', error);
        return NextResponse.json({ error: '목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { title, data } = await request.json();
        validateCase(title, data);
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
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        console.error('Creditor list save error:', error);
        return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
