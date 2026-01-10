import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const PROMPT_DIR = path.join(process.cwd(), 'prompts', 'rehabilitation');

export async function GET() {
  try {
    const creditorPrompt = await fs.readFile(path.join(PROMPT_DIR, 'creditor.txt'), 'utf-8');
    const planPrompt = await fs.readFile(path.join(PROMPT_DIR, 'plan.txt'), 'utf-8');

    return NextResponse.json({
      success: true,
      data: { creditorPrompt, planPrompt }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: '프롬프트를 로드할 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type, content } = await req.json();

    if (!['creditor', 'plan'].includes(type)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 타입입니다.' }, { status: 400 });
    }

    const fileName = `${type}.txt`;
    await fs.writeFile(path.join(PROMPT_DIR, fileName), content, 'utf-8');

    return NextResponse.json({ success: true, message: '프롬프트가 저장되었습니다.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: '프롬프트를 저장할 수 없습니다.' }, { status: 500 });
  }
}
