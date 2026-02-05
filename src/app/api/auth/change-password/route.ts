import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export async function POST(request: NextRequest) {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
        return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' }, { status: 400 });
        }

        // 사용자 조회
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

        if (!user) {
            return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
        }

        // 현재 비밀번호 확인
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 400 });
        }

        // 새 비밀번호 해싱 및 갱신
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);

        return NextResponse.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error('Password change error:', error);
        return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
