import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

// GET: 특정 프롬프트 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const promptId = parseInt(id);
    const prompt = (await query(
      'SELECT * FROM prompts WHERE id = $1 AND user_id = $2',
      [promptId, userId]
    )).rows[0];

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
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const promptId = parseInt(id);
    const { name, prompt, model, category, is_favorite } = await request.json();

    // 권한 확인
    const existing = (await query(
      'SELECT * FROM prompts WHERE id = $1 AND user_id = $2',
      [promptId, userId]
    )).rows[0];

    if (!existing) {
      return NextResponse.json(
        { error: '프롬프트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await query(`
      UPDATE prompts
      SET name = COALESCE($1, name),
          prompt = COALESCE($2, prompt),
          model = COALESCE($3, model),
          category = COALESCE($4, category),
          is_favorite = COALESCE($5, is_favorite),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7
    `, [name, prompt, model, category, is_favorite !== undefined ? is_favorite : null, promptId, userId]);

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
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const promptId = parseInt(id);

    // 권한 확인
    const existing = (await query(
      'SELECT * FROM prompts WHERE id = $1 AND user_id = $2',
      [promptId, userId]
    )).rows[0];

    if (!existing) {
      return NextResponse.json(
        { error: '프롬프트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await query('DELETE FROM prompts WHERE id = $1 AND user_id = $2', [promptId, userId]);

    return NextResponse.json({ message: '프롬프트가 삭제되었습니다.' });
  } catch (error: any) {
    console.error('Prompt delete error:', error);
    return NextResponse.json(
      { error: '프롬프트 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
