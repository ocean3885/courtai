export interface CreditorData {
  name: string;
  principal: number;
  interest: number;
  baseDate: string;
  total: number;
}

export interface ValidationResult {
  creditorName: string;
  isValid: boolean;
  errors: string[];
}
