export type LitigationCostCaseData = {
  court: string;
  caseNumber: string;
  applicationDate: string;
  parties: unknown[];
  stages: unknown[];
  applicationCosts: unknown[];
};

export function validateLitigationCostCaseData(data: unknown): data is LitigationCostCaseData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const value = data as Record<string, unknown>;
  if (
    typeof value.court !== 'string' || value.court.length > 200 ||
    typeof value.caseNumber !== 'string' || value.caseNumber.length > 200 ||
    typeof value.applicationDate !== 'string' || value.applicationDate.length > 20 ||
    !Array.isArray(value.parties) || value.parties.length > 500 ||
    !Array.isArray(value.stages) || value.stages.length > 20 ||
    !Array.isArray(value.applicationCosts) || value.applicationCosts.length > 500
  ) return false;

  return Buffer.byteLength(JSON.stringify(data), 'utf8') <= 1_000_000;
}