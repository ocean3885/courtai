import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';
import { enrichDocumentData } from '@/lib/document-service';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getUserFromToken(req: NextRequest): { id: number; role: string } | null {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) return null;

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return { id: decoded.id, role: decoded.role };
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: creditorId } = await params;
    const body = await req.json();
    const { title, data } = body;

    // 1. 데이터 강화 (계산 로직 적용 등)
    // 이 단계에서 변제계획표 등 '확정'되어야 할 데이터를 계산하여 JSON에 포함시킵니다.
    const enrichedData = enrichDocumentData(data);

    // creditor 테이블에 저장/업데이트 (원본 데이터 유지)
    const updateCreditor = db.prepare(`
      UPDATE creditor 
      SET data = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    updateCreditor.run(JSON.stringify(data), creditorId);

    // 현재 날짜를 한국식 형식으로 변환 (2026. 1. 4.자)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const koreanDate = `${year}. ${month}. ${day}.자`;

    // case_documents 테이블에 저장
    // HTML은 저장하지 않고(빈 문자열), enrichedData(JSON)만 스냅샷으로 저장합니다.
    const insertDocument = db.prepare(`
      INSERT INTO case_documents (creditor_id, title, source_snapshot, changes, html_preview)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insertDocument.run(
      creditorId,
      `${koreanDate} 채권자목록 및 변제계획안`,
      JSON.stringify(enrichedData),
      '', // changes
      ''  // html_preview (On-the-fly 생성으로 변경되어 빈 값 저장)
    );

    return NextResponse.json({
      success: true,
      documentId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('Document generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate document' },
      { status: 500 }
    );
  }
}
