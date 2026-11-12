import { validateCase, InputError } from '@/lib/case-validation';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { id } = await params;
        const list = (await query(`
            SELECT * FROM creditor WHERE id = $1 AND user_id = $2
        `, [id, userId])).rows[0];

        if (!list) return NextResponse.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 });

        return NextResponse.json({
            ...list,
            data: JSON.parse(list.data)
        });
    } catch (error) {
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { id } = await params;
        const { title, data } = await request.json();
        validateCase(title, data);

        const result = await query(`
            UPDATE creditor 
            SET title = $1, data = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND user_id = $4
        `, [title, JSON.stringify(data), id, userId]);

        if (!result.rowCount) return NextResponse.json({ error: '사건을 찾을 수 없습니다.' }, { status: 404 });
        return NextResponse.json({ success: true, message: '수정되었습니다.' });
    } catch (error) {
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ error: '수정 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        const { id } = await params;
        const result = await query(`DELETE FROM creditor WHERE id = $1 AND user_id = $2`, [id, userId]);

        if (!result.rowCount) return NextResponse.json({ error: '사건을 찾을 수 없습니다.' }, { status: 404 });
        return NextResponse.json({ success: true, message: '삭제되었습니다.' });
    } catch (error) {
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
