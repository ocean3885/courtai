import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { createDocumentSnapshot } from '@/lib/document-snapshot';
import { validateCase, InputError } from '@/lib/case-validation';
import { generateChangeLog } from '@/lib/snapshot-diff';
import { getUserFromRequest } from '@/lib/auth';

interface PreviousDocumentRow {
  source_snapshot: string | null;
  changes: string | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = (await getUserFromRequest(req));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: creditorId } = await params;
    const body = await req.json();
    const { title, data } = body;

    validateCase(title, data, true);
    return await transaction(async query => {
    const creditor = (await query(`
      SELECT id
      FROM creditor
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
    `, [creditorId, user.id])).rows[0];

    if (!creditor) {
      return NextResponse.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 1. 데이터 강화 (계산 로직 적용 등)
    // 이 단계에서 변제계획표 등 '확정'되어야 할 데이터를 계산하여 JSON에 포함시킵니다.
    const { snapshot: enrichedData, rendered } = createDocumentSnapshot(title, data);

    // creditor 테이블에 저장/업데이트 (원본 데이터 유지)
    await query(`
      UPDATE creditor 
      SET title = $1, data = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3 AND user_id = $4
    `, [title, JSON.stringify(data), creditorId, user.id]);

    // 현재 날짜를 한국식 방식(KST)으로 변환 (2026. 1. 4.자)
    const now = new Date();
    const kstDatePart = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).format(now);
    // kstDatePart는 "2026. 1. 4." 형태 (끝에 점이 있을 수도 없을 수도 있음, 브라우저/노드 버전에 따라 다름)
    // 확실하게 포맷팅하기 위해 parts를 쓰거나, 단순하게 처리
    // 여기서는 Intl 결과를 그대로 사용하되, "자"를 붙임. 
    // "2026. 1. 4." -> "2026. 1. 4.자"
    const koreanDate = kstDatePart.endsWith('.') ? `${kstDatePart}자` : `${kstDatePart}.자`;

    // 이전 문서 조회 (가장 최근 문서)
    const previousDocument = (await query<PreviousDocumentRow>(`
      SELECT source_snapshot, changes
      FROM case_documents
      WHERE creditor_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `, [creditorId])).rows[0];

    // 변경사항 계산 (직전 문서와의 차이만 저장)
    let changeLog = '';
    const kstFullString = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    if (previousDocument && previousDocument.source_snapshot) {
      changeLog = generateChangeLog(previousDocument.source_snapshot, enrichedData);
    } else {
      changeLog = `[${kstFullString}] 최초 생성`;
    }

    // case_documents 테이블에 저장
    // 계산 결과와 두 문서의 HTML을 생성 시점 그대로 저장합니다.
    const result = await query<{ id: number }>(`
      INSERT INTO case_documents (creditor_id, title, source_snapshot, changes, html_preview)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      creditorId,
      `${koreanDate} 채권자목록 및 변제계획안`,
      JSON.stringify(enrichedData),
      changeLog, // 변경사항 저장
      JSON.stringify(rendered)
    ]);

    return NextResponse.json({
      success: true,
      documentId: result.rows[0].id,
    });
    });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Document generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate document' },
      { status: 500 }
    );
  }
}
