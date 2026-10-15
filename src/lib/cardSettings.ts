export interface CardSettings {
  headerLine1: string;
  headerLine2: string;
  headerLine3: string;
  defaultIssueNo: string;
  headerLine1FontSize: number;
  headerLine2FontSize: number;
  headerLine3FontSize: number;
  contactFontSize: number;
  emergencyFontSize: number;
  employeeNameFontSize: number;
  issuingAuthorityFontSize: number;
  headerBackground: string;
  emergencyBackground: string;
}

export const defaultCardSettings: CardSettings = {
  headerLine1: 'West Bengal State Electricity Distribution Co. Ltd.',
  headerLine2: '(A Government Of West Bengal Enterprise)',
  headerLine3: '{{cccName}}',
  defaultIssueNo: '',
  headerLine1FontSize: 9,
  headerLine2FontSize: 7,
  headerLine3FontSize: 7,
  contactFontSize: 5,
  emergencyFontSize: 9,
  employeeNameFontSize: 14,
  issuingAuthorityFontSize: 6,
  headerBackground: '#4f46e5',
  emergencyBackground: '#f97316'
};

export function mergeCardSettings(value: unknown): CardSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultCardSettings;
  const source = value as Partial<CardSettings>;
  const fontSize = (candidate: unknown, fallback: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.min(24, Math.max(4, candidate))
      : fallback;
  const color = (candidate: unknown, fallback: string) =>
    typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;

  return {
    headerLine1: typeof source.headerLine1 === 'string' ? source.headerLine1 : defaultCardSettings.headerLine1,
    headerLine2: typeof source.headerLine2 === 'string' ? source.headerLine2 : defaultCardSettings.headerLine2,
    headerLine3: typeof source.headerLine3 === 'string' ? source.headerLine3 : defaultCardSettings.headerLine3,
    defaultIssueNo: typeof source.defaultIssueNo === 'string' ? source.defaultIssueNo : defaultCardSettings.defaultIssueNo,
    headerLine1FontSize: fontSize(source.headerLine1FontSize, defaultCardSettings.headerLine1FontSize),
    headerLine2FontSize: fontSize(source.headerLine2FontSize, defaultCardSettings.headerLine2FontSize),
    headerLine3FontSize: fontSize(source.headerLine3FontSize, defaultCardSettings.headerLine3FontSize),
    contactFontSize: fontSize(source.contactFontSize, defaultCardSettings.contactFontSize),
    emergencyFontSize: fontSize(source.emergencyFontSize, defaultCardSettings.emergencyFontSize),
    employeeNameFontSize: fontSize(source.employeeNameFontSize, defaultCardSettings.employeeNameFontSize),
    issuingAuthorityFontSize: fontSize(source.issuingAuthorityFontSize, defaultCardSettings.issuingAuthorityFontSize),
    headerBackground: color(source.headerBackground, defaultCardSettings.headerBackground),
    emergencyBackground: color(source.emergencyBackground, defaultCardSettings.emergencyBackground)
  };
}
