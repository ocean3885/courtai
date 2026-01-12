import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from '@/lib/db';
import { structureDocumentData } from '@/lib/api/openai';
import { structureDocumentDataGemini } from '@/lib/api/gemini';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// 관리자 권한 확인
async function checkAdminAuth(request: NextRequest): Promise<{ isAdmin: boolean; userId: number | null }> {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return { isAdmin: false, userId: null };
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return { isAdmin: decoded.role === 'ADMIN', userId: decoded.id };
  } catch (error) {
    return { isAdmin: false, userId: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const { isAdmin, userId } = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { model, prompt, inputText, promptId } = await request.json();

    // 필수 필드 검증
    if (!model || !prompt || !inputText) {
      return NextResponse.json(
        { error: '모델, 프롬프트, 입력 텍스트가 필요합니다.' },
        { status: 400 }
      );
    }

    // 모델 유효성 검사
    if (!['gemini', 'openai'].includes(model)) {
      return NextResponse.json(
        { error: '지원하지 않는 모델입니다.' },
        { status: 400 }
      );
    }

    let result;

    try {
      if (model === 'gemini') {
        result = await structureDocumentDataGemini(inputText, prompt);
      } else {
        result = await structureDocumentData(inputText, prompt);
      }
    } catch (error: any) {
      console.error(`${model} API Error:`, error);
      return NextResponse.json(
        { error: `${model} API 요청 실패: ${error.message}` },
        { status: 500 }
      );
    }

    // 프롬프트 사용 횟수 업데이트 (저장된 프롬프트인 경우)
    if (promptId && userId) {
      try {
        const stmt = db.prepare(`
          UPDATE prompts
          SET usage_count = usage_count + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `);
        stmt.run(promptId, userId);
      } catch (error) {
        console.error('Failed to update usage count:', error);
        // 업데이트 실패는 무시하고 진행
      }
    }

    return NextResponse.json({
      result: result || '결과를 생성하지 못했습니다.',
    });
  } catch (error: any) {
    console.error('Prompt test execution error:', error);
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
