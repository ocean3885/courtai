import OpenAI from 'openai';
import { CreditorData, ValidationResult } from '@/types/rehabilitation';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function structureDocumentData(text: string, customPrompt: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
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
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) return null;
  
  return JSON.parse(content);
}

export async function structureBankruptcyData(text: string, customPrompt?: string): Promise<CreditorData[]> {
  const defaultPrompt = `You are an expert at parsing personal rehabilitation (개인회생) documents. 
        Extract creditor information into a JSON array. 
        Each object should have: name (채권자명), principal (원금), interest (이자), baseDate (산정기준일, YYYY-MM-DD), total (합계).
        If multiple creditors are present, list them all. 
        Only return valid JSON.`;

  const parsed = await structureDocumentData(text, customPrompt || defaultPrompt);
  // Expecting { "creditors": [...] }
  return parsed?.creditors || [];
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
