import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { validateLitigationCostCaseData } from '@/lib/litigation-cost-validation';

type RouteContext = { params: Promise<{ id: string }> };

function validId(id: string): boolean {
  return /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const { id } = await params;
    if (!validId(id)) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });

    const record = (await query(`
      SELECT id, title, court, case_number, application_date, data, created_at, updated_at
      FROM litigation_cost_cases WHERE id = $1 AND user_id = $2
    `, [id, userId])).rows[0];
    if (!record) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json(record);
  } catch (error) {
    console.error('Litigation cost case fetch error:', error);
    return NextResponse.json({ error: '자료를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const { id } = await params;
    if (!validId(id)) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });

    const data: unknown = await request.json();
    if (!validateLitigationCostCaseData(data)) {
      return NextResponse.json({ error: '저장 자료의 형식이 올바르지 않습니다.' }, { status: 400 });
    }
    const title = data.caseNumber.trim() || `${data.court.trim()} 소송비용액확정`.trim();
    const result = await query(`
      UPDATE litigation_cost_cases
      SET title = $1, court = $2, case_number = $3, application_date = $4,
          data = $5::jsonb, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7
    `, [title || '소송비용액확정', data.court, data.caseNumber, data.applicationDate, JSON.stringify(data), id, userId]);
    if (!result.rowCount) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ id: Number(id), message: '수정되었습니다.' });
  } catch (error) {
    console.error('Litigation cost case update error:', error);
    return NextResponse.json({ error: '자료 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const { id } = await params;
    if (!validId(id)) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });

    const result = await query(
      `DELETE FROM litigation_cost_cases WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (!result.rowCount) return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ id: Number(id), message: '삭제되었습니다.' });
  } catch (error) {
    console.error('Litigation cost case delete error:', error);
    return NextResponse.json({ error: '자료 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}