// Shared TypeScript interfaces for case input

export interface DebtorInfo {
    name: string;
    birthDate: string; // YYYYMMDD 형식
    address: string;
    phone: string;
    court: string; // 관할법원
}

export interface SubrogatedCreditor {
    id: string;
    number: string; // 예: 14-1
    name: string;
    reason: string;
    address: string;
    phone: string;
    fax: string;
    principal: number; // 구상원금
    damages: number; // 손해금(기타)
    interest: number;
    interestStartDate: string;
    interestRate: string;
    baseDate: string;
}

export interface SecuredCreditorData {
    currentAmount: number; // 채권현재액
    expectedRepaymentAmount: number; // 별제권행사등으로 변제가 예상되는 채권액
    unrepayableAmount: number; // 별제권행사등으로도 변제받을 수 없을 채권액
    securedRehabilitationAmount: number; // 담보부회생채권액
    maxAmount: number; // 채권최고액
    collateralObject: string; // 목적물
    securedRightDetails: string; // 별제권내용
    expectedLiquidationValue: string; // 환가예상액 (계산식)
}

export interface Creditor {
    id: string;
    number: string; // 예: 14
    name: string;
    reason: string;
    address: string;
    phone: string;
    fax: string;
    principal: number;
    interest: number;
    interestStartDate: string;
    interestRate: string;
    baseDate: string;
    isSubrogated: boolean;
    subrogationData?: SubrogatedCreditor;
    isSecured: boolean; // 별제권부채권 여부
    securedData?: SecuredCreditorData; // 별제권부채권 정보
    isPreferential: boolean; // 우선변제 여부
}

export interface SavedList {
    id: string;
    title: string;
    data: { debtorInfo?: DebtorInfo; creditors?: Creditor[]; repaymentPlan?: RepaymentPlan } | Creditor[];
    updated_at: string;
}

export interface RepaymentPlan {
    repaymentPeriod: {
        startDate: string;
        endDate: string;
        months: number;
    };
    incomeType: 'wage' | 'business';
    monthlyAverageIncome: number;
    monthlyAverageLivingCost: number;
    monthlyAverageAvailableIncome: number;
    monthlyTrusteeFee: number;
    otherEstateClaims: number;
    monthlyActualAvailableIncome: number;
    repaymentCount: number;
    totalActualAvailableIncome: number;
    trusteeFee: {
        preConfirmation: number;
        postConfirmationRate: number;
    };
    dependentsCount: number;
    standardMedianIncome: number;
    adjustedLivingCost: number;
    createDate: string;
}
