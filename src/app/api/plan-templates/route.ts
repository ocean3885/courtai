import { validateTemplate, InputError } from '@/lib/case-validation';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

// 템플릿 목록 조회
export async function GET(request: NextRequest) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const templates = (await query(`
      SELECT id, name, creditors, monthly_available, months, created_at
      FROM repayment_plan_templates
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId])).rows;

        // creditors JSON 파싱
        const formattedTemplates = templates.map((t) => ({
            ...t,
            creditors: JSON.parse(t.creditors),
            monthlyAvailable: t.monthly_available, // 카멜케이스 변환
        }));

        return NextResponse.json({ templates: formattedTemplates });
    } catch (error) {
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        console.error('Template list error:', error);
        return NextResponse.json({ error: '템플릿 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

// 템플릿 저장
export async function POST(request: NextRequest) {
    try {
        const userId = (await getUserIdFromRequest(request));
        if (!userId) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const { name, creditors, monthlyAvailable, months } = await request.json();
        validateTemplate(creditors, monthlyAvailable, months);

        if (typeof name !== 'string' || !name.trim() || name.length > 200) {
            return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
        }

        const result = await query<{ id: number }>(`
      INSERT INTO repayment_plan_templates (user_id, name, creditors, monthly_available, months)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
            userId,
            name,
            JSON.stringify(creditors),
            monthlyAvailable,
            months
        ]);

        return NextResponse.json({
            success: true,
            id: result.rows[0].id,
            message: '설정이 저장되었습니다.',
        });
    } catch (error) {
        if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
        console.error('Template save error:', error);
        return NextResponse.json({ error: '설정 저장 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
