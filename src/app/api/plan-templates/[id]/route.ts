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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const { id } = await params;

        const deleteStmt = db.prepare(`
      DELETE FROM repayment_plan_templates
      WHERE id = ? AND user_id = ?
    `);

        const result = deleteStmt.run(id, userId);

        if (result.changes === 0) {
            return NextResponse.json({ error: '삭제할 템플릿을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: '설정이 삭제되었습니다.' });
    } catch (error) {
        console.error('Template delete error:', error);
        return NextResponse.json({ error: '설정 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const { id } = await params;
        const { creditors, monthlyAvailable, months } = await request.json();

        const updateStmt = db.prepare(`
      UPDATE repayment_plan_templates
      SET creditors = ?, monthly_available = ?, months = ?
      WHERE id = ? AND user_id = ?
    `);

        const result = updateStmt.run(
            JSON.stringify(creditors),
            monthlyAvailable,
            months,
            id,
            userId
        );

        if (result.changes === 0) {
            return NextResponse.json({ error: '수정할 템플릿을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: '설정이 덮어씌워졌습니다.' });
    } catch (error) {
        console.error('Template update error:', error);
        return NextResponse.json({ error: '설정 저장 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
