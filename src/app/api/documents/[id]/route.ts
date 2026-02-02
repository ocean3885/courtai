import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import jwt from 'jsonwebtoken';
import { generateDocumentHTML } from '@/lib/document-service';

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

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = getUserFromToken(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: documentId } = await params;

        const getDocument = db.prepare(`
      SELECT cd.*, c.user_id
      FROM case_documents cd
      JOIN creditor c ON cd.creditor_id = c.id
      WHERE cd.id = ?
    `);

        const document: any = getDocument.get(documentId);

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 권한 확인 (본인 또는 관리자만)
        if (document.user_id !== user.id && user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // On-the-fly HTML 생성
        // source_snapshot(JSON)을 파싱하여 즉석에서 HTML을 만들어줍니다.
        try {
            const parsedData = JSON.parse(document.source_snapshot);
            document.html_preview = generateDocumentHTML(document.title, parsedData);
            document.snapshot_data = parsedData; // 프론트엔드에서 사용할 수 있도록 파싱된 데이터 추가
        } catch (e) {
            console.error('Failed to parse snapshot or generate HTML:', e);
            // JSON 파싱 실패 시, 기존에 저장된(혹은 없을 수도 있는) html_preview를 그대로 둡니다.
            // 하지만 새 로직에서는 html_preview가 빈 문자열일 수 있으므로 에러 처리가 중요합니다.
            if (!document.html_preview) {
                document.html_preview = '<div style="padding:20px; text-align:center;">문서 생성 중 오류가 발생했습니다. (데이터 손상)</div>';
            }
        }

        return NextResponse.json(document);
    } catch (error) {
        console.error('Document fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch document' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = getUserFromToken(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: documentId } = await params;

        // 문서 소유자 확인
        const getDocument = db.prepare(`
      SELECT cd.*, c.user_id
      FROM case_documents cd
      JOIN creditor c ON cd.creditor_id = c.id
      WHERE cd.id = ?
    `);

        const document: any = getDocument.get(documentId);

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 권한 확인 (본인 또는 관리자만)
        if (document.user_id !== user.id && user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 문서 삭제
        const deleteDocument = db.prepare(`
      DELETE FROM case_documents WHERE id = ?
    `);

        deleteDocument.run(documentId);

        return NextResponse.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Document delete error:', error);
        return NextResponse.json(
            { error: 'Failed to delete document' },
            { status: 500 }
        );
    }
}
