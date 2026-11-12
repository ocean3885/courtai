import { validateTemplate, InputError } from '@/lib/case-validation';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const { id } = await params;

        const result = await query(`
      DELETE FROM repayment_plan_templates
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);

        if (result.rowCount === 0) {
            return NextResponse.json({ error: '삭제할 템플릿을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: '설정이 삭제되었습니다.' });
    } catch (error) {
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        console.error('Template delete error:', error);
        return NextResponse.json({ error: '설정 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const { id } = await params;
        const { creditors, monthlyAvailable, months } = await request.json();
        validateTemplate(creditors, monthlyAvailable, months);

        const result = await query(`
      UPDATE repayment_plan_templates
      SET creditors = $1, monthly_available = $2, months = $3
      WHERE id = $4 AND user_id = $5
    `, [
            JSON.stringify(creditors),
            monthlyAvailable,
            months,
            id,
            userId
        ]);

        if (result.rowCount === 0) {
            return NextResponse.json({ error: '수정할 템플릿을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: '설정이 덮어씌워졌습니다.' });
    } catch (error) {
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        console.error('Template update error:', error);
        return NextResponse.json({ error: '설정 저장 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
