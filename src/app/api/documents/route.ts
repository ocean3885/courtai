import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const user = getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 본인의 문서 목록 조회
        const getDocuments = db.prepare(`
      SELECT cd.id, cd.creditor_id, cd.title, cd.created_at
      FROM case_documents cd
      JOIN creditor c ON cd.creditor_id = c.id
      WHERE c.user_id = ?
      ORDER BY cd.created_at DESC
    `);

        const documents = getDocuments.all(user.id);

        return NextResponse.json(documents);
    } catch (error) {
        console.error('Documents fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch documents' },
            { status: 500 }
        );
    }
}
