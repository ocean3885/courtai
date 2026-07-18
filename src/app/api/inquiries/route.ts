import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const { title, content } = await request.json();

        if (!title || !content) {
            return NextResponse.json({ error: '제목과 내용을 모두 입력해주세요.' }, { status: 400 });
        }

        // 사용자 정보 확인 (로그인한 경우)
        const token = request.cookies.get('auth_token')?.value;
        let userId = null;

        if (token) {
            try {
                userId = getUserFromRequest(request)?.id ?? null;
            } catch (e) {
                // 토큰이 유효하지 않은 경우 무시하고 비회원으로 처리
            }
        }

        const stmt = db.prepare('INSERT INTO inquiries (user_id, title, content) VALUES (?, ?, ?)');
        stmt.run(userId, title, content);

        return NextResponse.json({ message: '문의가 성공적으로 접수되었습니다.' }, { status: 201 });
    } catch (error) {
        console.error('Inquiry submission error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
