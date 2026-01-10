import { NextRequest, NextResponse } from 'next/server';
import { parseLayout, extractTextFromLayout } from '@/lib/api/upstage';
import { structureBankruptcyData, structureDocumentData, generateFinalReport } from '@/lib/api/openai';
import { validateCreditorData } from '@/lib/rehabilitation/validator';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const creditorFile = formData.get('creditorFile') as File;
    const planFile = formData.get('planFile') as File;
    const creditorPrompt = formData.get('creditorPrompt') as string;
    const planPrompt = formData.get('planPrompt') as string;
    const mode = formData.get('mode') as string; // 'parse' or 'structure'

    const tempDir = path.join(process.cwd(), 'temp_parsing');
    await fs.mkdir(tempDir, { recursive: true });

    if (mode === 'parse') {
      if (!creditorFile || !planFile) {
        return NextResponse.json({ error: 'Both files are required' }, { status: 400 });
      }

      // 1. Upstage Parsing & Save to temp (using original filenames)
      const parseItems = [
        { file: creditorFile, key: 'creditor' },
        { file: planFile, key: 'plan' }
      ];

      const results = [];
      const filesData = [];
      for (const item of parseItems) {
        const buffer = Buffer.from(await item.file.arrayBuffer());
        const layoutData = await parseLayout(buffer, item.file.name);
        const text = extractTextFromLayout(layoutData);
        
        // Use original filename (changing extension to .txt)
        const originalName = item.file.name;
        const fileNameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        const txtFileName = `${fileNameWithoutExt}.txt`;
        const filePath = path.join(tempDir, txtFileName);
        
        await fs.writeFile(filePath, text, 'utf-8');
        
        // Save as a fixed name as well for internal fallback without mapping files
        const fixedPath = path.join(tempDir, `${item.key}_latest.txt`);
        await fs.writeFile(fixedPath, text, 'utf-8');

        results.push(originalName);
        filesData.push({ name: txtFileName, content: text });
      }

      return NextResponse.json({
        success: true,
        message: '2개 파일이 파싱이 완료되었습니다.',
        files: results,
        filesData: filesData
      });
    }

    if (mode === 'structure') {
      // 2. OpenAI Structuring using separate prompts
      const creditorTxt = formData.get('creditorTxt') as File;
      const planTxt = formData.get('planTxt') as File;

      let creditorText = '';
      let planText = '';

      try {
        if (creditorTxt && creditorTxt.size > 0) {
          creditorText = await creditorTxt.text();
        } else {
          creditorText = await fs.readFile(path.join(tempDir, 'creditor_latest.txt'), 'utf-8');
        }

        if (planTxt && planTxt.size > 0) {
          planText = await planTxt.text();
        } else {
          planText = await fs.readFile(path.join(tempDir, 'plan_latest.txt'), 'utf-8');
        }
      } catch (e) {
        return NextResponse.json({ error: '데이터 소스가 없습니다. TXT 파일을 업로드하거나 먼저 PDF 파싱을 진행해 주세요.' }, { status: 400 });
      }

      // Separate LLM calls
      const [structuredCreditors, structuredPlan] = await Promise.all([
        structureBankruptcyData(creditorText, creditorPrompt),
        structureDocumentData(planText, planPrompt)
      ]);

      return NextResponse.json({
        success: true,
        data: {
          structuredCreditors,
          structuredPlan
        }
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error: any) {
    console.error('Processing Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
