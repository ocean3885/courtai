import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createDocumentSnapshot, readRenderedDocuments } from '@/lib/document-snapshot';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = (await getUserFromRequest(req));
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: documentId } = await params;

        const document = (await query(`
      SELECT cd.*, c.user_id
      FROM case_documents cd
      JOIN creditor c ON cd.creditor_id = c.id
      WHERE cd.id = $1
    `, [documentId])).rows[0];

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 권한 확인 (본인 또는 관리자만)
        if (document.user_id !== user.id && user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // New documents are frozen; legacy documents are safely rendered without overwriting history.
        const parsedData = JSON.parse(document.source_snapshot);
        const frozen = readRenderedDocuments(document.html_preview);
        const rendered = frozen ?? createDocumentSnapshot(document.title, {
            ...parsedData,
            repaymentPlan: { ...parsedData.repaymentPlan,
                repaymentCount: parsedData.repaymentPlan?.repaymentPeriod?.months || 36,
                createDate: parsedData.repaymentPlan?.createDate || new Date(document.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) },
        }).rendered;
        document.html_preview = rendered.creditorListHtml;
        document.repayment_plan_html = rendered.repaymentPlanHtml;
        document.snapshot_data = parsedData;
        document.is_legacy = !frozen;

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
        const user = (await getUserFromRequest(req));
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: documentId } = await params;

        // 문서 소유자 확인
        const document = (await query(`
      SELECT cd.*, c.user_id
      FROM case_documents cd
      JOIN creditor c ON cd.creditor_id = c.id
      WHERE cd.id = $1
    `, [documentId])).rows[0];

        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // 권한 확인 (본인 또는 관리자만)
        if (document.user_id !== user.id && user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 문서 삭제
        await query(`
      DELETE FROM case_documents WHERE id = $1
    `, [documentId]);

        return NextResponse.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Document delete error:', error);
        return NextResponse.json(
            { error: 'Failed to delete document' },
            { status: 500 }
        );
    }
}
