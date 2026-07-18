import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

// GET: 모든 프롬프트 조회
export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const prompts = db
      .prepare('SELECT * FROM prompts WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId);

    return NextResponse.json({ prompts });
  } catch (error: any) {
    console.error('Prompt fetch error:', error);
    return NextResponse.json(
      { error: '프롬프트 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 프롬프트 저장
export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { name, prompt, model, category } = await request.json();

    if (!name || !prompt || !model) {
      return NextResponse.json(
        { error: '이름, 프롬프트, 모델이 필요합니다.' },
        { status: 400 }
      );
    }

    const stmt = db.prepare(`
      INSERT INTO prompts (user_id, name, prompt, model, category)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(userId, name, prompt, model, category || null);

    return NextResponse.json({
      id: result.lastInsertRowid,
      name,
      prompt,
      model,
      category,
      created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Prompt save error:', error);
    return NextResponse.json(
      { error: '프롬프트 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
