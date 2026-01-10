import axios from 'axios';
import FormData from 'form-data';

const UPSTAGE_API_KEY = process.env.UPSTAGE_API_KEY;

export async function parseLayout(fileBuffer: Buffer, fileName: string) {
  const url = 'https://api.upstage.ai/v1/document-digitization';
  
  const formData = new FormData();
  formData.append('document', fileBuffer, { filename: fileName });
  formData.append('output_formats', JSON.stringify(['markdown']));
  formData.append('model', 'document-parse');
  formData.append('ocr', 'auto');

  try {
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${UPSTAGE_API_KEY}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Upstage Layout Analysis Error:', error);
    throw error;
  }
}

interface UpstageElement {
  type: string;
  content?: {
    text?: string;
    markdown?: string;
    html?: string;
  };
}

interface UpstageLayoutResponse {
  elements: UpstageElement[];
}

/**
 * Extracts text while trying to maintain some structural context.
 * For tables, it might need more sophisticated processing depending on Upstage's JSON output.
 */
export function extractTextFromLayout(layoutData: any) {
  // Document Digitization API (document-parse) returns results in a 'content' field or objects depending on version
  // Based on standard output_formats: ["text", "markdown", "html"]
  if (layoutData.content?.markdown) {
    return layoutData.content.markdown;
  }
  
  if (layoutData.text) {
    return layoutData.text;
  }

  // Fallback if it returns elements (Layout Analysis Style)
  if (layoutData.elements) {
    return layoutData.elements
      .map((el: any) => el.content?.markdown || el.content?.text || '')
      .join('\n');
  }

  return JSON.stringify(layoutData);
}
