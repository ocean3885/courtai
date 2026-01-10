import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const creditorFile = formData.get('creditor') as File | null;
        const planFile = formData.get('plan') as File | null;

        const results: any = {
            creditor: { caseNumber: null, documentType: 'unknown', error: null },
            plan: { caseNumber: null, documentType: 'unknown', error: null },
            globalError: null
        };

        const validateFile = async (file: File, expectedType: 'creditor' | 'plan') => {
            const fileName = file.name.replace(/\s/g, '');

            let documentType = 'unknown';
            if (fileName.includes('채권자')) documentType = 'creditor';
            else if (fileName.includes('변제계획')) documentType = 'plan';

            // Case number extraction from filename
            const caseMatch = fileName.match(/20[0-2][0-9]개회[0-9]+/);

            return {
                caseNumber: caseMatch ? caseMatch[0] : null,
                documentType
            };
        };

        if (creditorFile) {
            const val = await validateFile(creditorFile, 'creditor');
            if (val) {
                results.creditor = val;
                if (val.documentType !== 'creditor' && val.documentType !== 'unknown') {
                    results.creditor.error = "채권자 목록 자리에 변제계획안이 첨부된 것 같습니다.";
                }
            }
        }

        if (planFile) {
            const val = await validateFile(planFile, 'plan');
            if (val) {
                results.plan = val;
                if (val.documentType !== 'plan' && val.documentType !== 'unknown') {
                    results.plan.error = "변제계획안 자리에 채권자 목록이 첨부된 것 같습니다.";
                }
            }
        }

        // Compare case numbers if both exist
        if (results.creditor.caseNumber && results.plan.caseNumber) {
            if (results.creditor.caseNumber !== results.plan.caseNumber) {
                results.globalError = `사건번호가 일치하지 않습니다. (채권자: ${results.creditor.caseNumber}, 변제계획안: ${results.plan.caseNumber})`;
            }
        }

        return NextResponse.json({ success: true, data: results });
    } catch (error: any) {
        console.error('Validation Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
