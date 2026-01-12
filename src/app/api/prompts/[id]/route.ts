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

// GET: 특정 프롬프트 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const promptId = parseInt(id);
    const prompt = db
      .prepare('SELECT * FROM prompts WHERE id = ? AND user_id = ?')
      .get(promptId, userId);

    if (!prompt) {
      return NextResponse.json(
        { error: '프롬프트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ prompt });
  } catch (error: any) {
    console.error('Prompt fetch error:', error);
    return NextResponse.json(
      { error: '프롬프트 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT: 프롬프트 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const promptId = parseInt(id);
    const { name, prompt, model, category, is_favorite } = await request.json();

    // 권한 확인
    const existing = db
      .prepare('SELECT * FROM prompts WHERE id = ? AND user_id = ?')
      .get(promptId, userId);

    if (!existing) {
      return NextResponse.json(
        { error: '프롬프트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const stmt = db.prepare(`
      UPDATE prompts
      SET name = COALESCE(?, name),
          prompt = COALESCE(?, prompt),
          model = COALESCE(?, model),
          category = COALESCE(?, category),
          is_favorite = COALESCE(?, is_favorite),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(name, prompt, model, category, is_favorite !== undefined ? is_favorite : null, promptId, userId);

    return NextResponse.json({ id: promptId, name, prompt, model, category, is_favorite });
  } catch (error: any) {
    console.error('Prompt update error:', error);
    return NextResponse.json(
      { error: '프롬프트 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 프롬프트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const promptId = parseInt(id);

    // 권한 확인
    const existing = db
      .prepare('SELECT * FROM prompts WHERE id = ? AND user_id = ?')
      .get(promptId, userId);

    if (!existing) {
      return NextResponse.json(
        { error: '프롬프트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const stmt = db.prepare('DELETE FROM prompts WHERE id = ? AND user_id = ?');
    stmt.run(promptId, userId);

    return NextResponse.json({ message: '프롬프트가 삭제되었습니다.' });
  } catch (error: any) {
    console.error('Prompt delete error:', error);
    return NextResponse.json(
      { error: '프롬프트 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
