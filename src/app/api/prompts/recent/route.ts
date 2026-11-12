import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

// GET: 최근 프롬프트 조회 (단일)
export async function GET(request: NextRequest) {
  try {
    const userId = (await getUserIdFromRequest(request));
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const recentPrompt = (await query(`
        SELECT * FROM prompts 
        WHERE user_id = $1 
        ORDER BY updated_at DESC 
        LIMIT 1
      `, [userId])).rows[0];

    if (!recentPrompt) {
      return NextResponse.json({ prompt: null });
    }

    return NextResponse.json({ prompt: recentPrompt });
  } catch (error: unknown) {
    console.error('Recent prompt fetch error:', error);
    return NextResponse.json(
      { error: '최근 프롬프트 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
