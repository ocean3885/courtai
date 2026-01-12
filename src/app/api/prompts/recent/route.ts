import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// JWT에서 user_id 추출
function getUserIdFromToken(request: NextRequest): number | null {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded.id;
  } catch (error) {
    return null;
  }
}

// GET: 최근 프롬프트 조회 (단일)
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const recentPrompt = db
      .prepare(`
        SELECT * FROM prompts 
        WHERE user_id = ? 
        ORDER BY updated_at DESC 
        LIMIT 1
      `)
      .get(userId);

    if (!recentPrompt) {
      return NextResponse.json({ prompt: null });
    }

    return NextResponse.json({ prompt: recentPrompt });
  } catch (error: any) {
    console.error('Recent prompt fetch error:', error);
    return NextResponse.json(
      { error: '최근 프롬프트 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
