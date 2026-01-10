import { NextRequest, NextResponse } from 'next/server';
import { structureBankruptcyData, structureDocumentData } from '@/lib/api/openai';
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

      const results = [];
      const filesData = [];
      const parseItems = [
        { file: creditorFile, key: 'creditor' },
        { file: planFile, key: 'plan' }
      ];

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      for (const item of parseItems) {
        const buffer = Buffer.from(await item.file.arrayBuffer());

        // Save temporary PDF
        const originalName = item.file.name;
        const tempPdfPath = path.join(tempDir, `temp_${Date.now()}_${originalName}`);
        await fs.writeFile(tempPdfPath, buffer);

        // Define output TXT path
        const fileNameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        const txtFileName = `${fileNameWithoutExt}.txt`;
        const filePath = path.join(tempDir, txtFileName);
        const fixedPath = path.join(tempDir, `${item.key}_latest.txt`);

        try {
          // Execute Python script
          const pythonScriptPath = path.join(process.cwd(), 'src', 'lib', 'rehabilitation', 'pdf_parser.py');
          const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python');
          await execAsync(`"${pythonPath}" "${pythonScriptPath}" "${tempPdfPath}" "${filePath}"`);

          const text = await fs.readFile(filePath, 'utf-8');
          await fs.writeFile(fixedPath, text, 'utf-8');

          results.push(originalName);
          filesData.push({ name: txtFileName, content: text });
        } catch (execError: any) {
          console.error(`Error parsing ${originalName}:`, execError);
          throw new Error(`PDF 파싱 중 오류가 발생했습니다 (${originalName}): ${execError.message}`);
        } finally {
          // Cleanup temp PDF
          try { await fs.unlink(tempPdfPath); } catch (e) { }
        }
      }

      return NextResponse.json({
        success: true,
        message: '2개 파일의 파싱이 완료되었습니다 (pdfplumber 사용).',
        files: results,
        filesData: filesData
      });
    }

    if (mode === 'structure') {
      const modelType = (formData.get('modelType') as string) || 'gemini';
      const modelVersion = (formData.get('modelVersion') as string) || (modelType === 'openai' ? 'gpt-4o' : 'gemini-2.0-flash-exp');
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

      let structuredCreditors, structuredPlan;

      if (modelType === 'gemini') {
        const { structureDocumentDataGemini } = await import('@/lib/api/gemini');
        [structuredCreditors, structuredPlan] = await Promise.all([
          structureDocumentDataGemini(creditorText, creditorPrompt || "Extract creditors into a JSON object with a 'creditors' array.", modelVersion),
          structureDocumentDataGemini(planText, planPrompt || "Extract plan info into JSON.", modelVersion)
        ]);
        // Handle Gemini returning the whole object vs array
        if (structuredCreditors && !Array.isArray(structuredCreditors) && structuredCreditors.creditors) {
          structuredCreditors = structuredCreditors.creditors;
        }
      } else {
        [structuredCreditors, structuredPlan] = await Promise.all([
          structureBankruptcyData(creditorText, creditorPrompt, modelVersion),
          structureDocumentData(planText, planPrompt, modelVersion)
        ]);
      }

      const combinedResult = {
        structuredCreditors,
        structuredPlan,
        metadata: {
          modelType,
          modelVersion,
          timestamp: new Date().toISOString()
        }
      };

      // Save to temp_parsing
      await fs.writeFile(
        path.join(tempDir, 'structured_latest.json'),
        JSON.stringify(combinedResult, null, 2),
        'utf-8'
      );

      return NextResponse.json({
        success: true,
        data: combinedResult
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error: any) {
    console.error('Processing Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
