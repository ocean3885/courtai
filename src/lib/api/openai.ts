import OpenAI from 'openai';
import { CreditorData, ValidationResult } from '@/types/rehabilitation';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function structureDocumentData(text: string, customPrompt: string, modelVersion: string = 'gpt-4o'): Promise<any> {
  const response = await openai.chat.completions.create({
    model: modelVersion,
    messages: [
      {
        role: 'system',
        content: customPrompt,
      },
      {
        role: 'user',
        content: text,
      },
    ],
  });

  const content = response.choices[0].message.content;
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (e) {
    // JSON이 아니면 원본 문자열 반환
    return content;
  }
}

export async function structureBankruptcyData(text: string, customPrompt?: string, modelVersion: string = 'gpt-4o'): Promise<CreditorData[]> {
  const defaultPrompt = `You are an expert at parsing personal rehabilitation (개인회생) documents. 
        Extract creditor information into a JSON array. 
        Each object should have: name (채권자명), principal (원금), interest (이자), baseDate (산정기준일, YYYY-MM-DD), total (합계).
        If multiple creditors are present, list them all. 
        Only return valid JSON.`;

  const parsed = await structureDocumentData(text, customPrompt || defaultPrompt, modelVersion);

  // JSON 객체 내에 creditors 배열이 있으면 추출, 아니면 파싱된 전체 결과(HTML 등) 반환
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.creditors) {
    return parsed.creditors;
  }
  return parsed;
}

export async function generateFinalReport(originalData: CreditorData[], validationResults: ValidationResult[]) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a legal assistant specializing in personal rehabilitation. 
        Summarize the data and the validation results for the user. 
        Explain any discrepancies (hallucinations or calculation errors) in simple Korean.`,
      },
      {
        role: 'user',
        content: `Original Structured Data: ${JSON.stringify(originalData)}
        Validation Results: ${JSON.stringify(validationResults)}`,
      },
    ],
  });

  return response.choices[0].message.content;
}
