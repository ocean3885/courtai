import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export async function GET(request: NextRequest) {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'ADMIN') {
            return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
        }

        const inquiries = db.prepare(`
      SELECT i.*, u.username as user_name 
      FROM inquiries i 
      LEFT JOIN users u ON i.user_id = u.id 
      ORDER BY i.created_at DESC
    `).all();

        return NextResponse.json(inquiries);
    } catch (error) {
        console.error('Admin inquiries fetch error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
