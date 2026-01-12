import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function structureDocumentDataGemini(text: string, customPrompt: string, modelVersion: string = "gemini-2.0-flash-exp"): Promise<any> {
    const model = genAI.getGenerativeModel({
        model: modelVersion,
    });

    const prompt = `${customPrompt}\n\nInput Text:\n${text}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();

        if (!content) return null;

        try {
            return JSON.parse(content);
        } catch (e) {
            return content;
        }
    } catch (error) {
        console.error("Gemini Structuring Error:", error);
        throw error;
    }
}
