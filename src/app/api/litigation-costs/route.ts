import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { validateLitigationCostCaseData } from '@/lib/litigation-cost-validation';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const records = (await query(`
      SELECT id, title, court, case_number, application_date, created_at, updated_at
      FROM litigation_cost_cases
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
    `, [userId])).rows;
    return NextResponse.json(records);
  } catch (error) {
    console.error('Litigation cost case list error:', error);
    return NextResponse.json({ error: '저장 자료를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

    const data: unknown = await request.json();
    if (!validateLitigationCostCaseData(data)) {
      return NextResponse.json({ error: '저장 자료의 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const title = data.caseNumber.trim() || `${data.court.trim()} 소송비용액확정`.trim();
    const result = await query<{ id: number }>(`
      INSERT INTO litigation_cost_cases (user_id, title, court, case_number, application_date, data)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id
    `, [userId, title || '소송비용액확정', data.court, data.caseNumber, data.applicationDate, JSON.stringify(data)]);
    return NextResponse.json({ id: result.rows[0].id, message: '저장되었습니다.' });
  } catch (error) {
    console.error('Litigation cost case save error:', error);
    return NextResponse.json({ error: '저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}