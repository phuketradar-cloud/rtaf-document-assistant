/** ชื่อช่องข้อมูลของบันทึกข้อความ */
export type FieldKey =
  | 'department'
  | 'docNumber'
  | 'date'
  | 'subject'
  | 'to'
  | 'reference'
  | 'enclosures'
  | 'body'
  | 'closing'
  | 'signerName'
  | 'signerPosition';

/** ข้อมูลที่ผู้ใช้กรอก (ไม่มีข้อมูลรูปแบบปะปน) — วันที่เก็บเป็น ISO yyyy-mm-dd */
export type MemoFields = Record<FieldKey, string>;

export type DocStatus = 'draft' | 'exported';

export interface DocumentRecord {
  id: string;
  type: 'memo';
  templateId: string;
  status: DocStatus;
  fields: MemoFields;
  createdAt: string;
  updatedAt: string;
  lastExportedAt?: string;
  copiedFromId?: string;
}

export type Alignment = 'left' | 'center' | 'right' | 'justify' | 'thaiDistribute';
export type DateStyle = 'full' | 'abbr' | 'abbrShortYear';

/** ป้ายชื่อที่พิมพ์ในเอกสาร (ผู้ใช้แก้ให้ตรงต้นฉบับได้) */
export type LabelKey = 'department' | 'docNumber' | 'date' | 'subject' | 'to' | 'reference' | 'enclosures';

/** รูปแบบเอกสาร (ไม่มีข้อมูลเนื้อหา) */
export interface MemoTemplate {
  id: string;
  name: string;
  description: string;
  /** แหล่งอ้างอิงของรูปแบบ เช่น ไฟล์ต้นฉบับของหน่วย หรือระเบียบที่ใช้ */
  sourceNote: string;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;

  marginTopCm: number;
  marginBottomCm: number;
  marginLeftCm: number;
  marginRightCm: number;

  fontName: string;
  fontSizePt: number;
  lineSpacing: number;
  paragraphSpacingAfterPt: number;

  titleText: string;
  titleFontSizePt: number;
  titleBold: boolean;
  titleAlign: Alignment;

  labels: Record<LabelKey, string>;
  labelBold: boolean;
  /** ตำแหน่งแท็บของ "วันที่" บนบรรทัดเดียวกับ "ที่" (ซม. จากขอบซ้าย), 0 = แยกบรรทัด */
  dateTabCm: number;
  /** ระยะเยื้องบรรทัดที่ 2 เป็นต้นไปของ อ้างถึง / สิ่งที่ส่งมาด้วย */
  continuationIndentCm: number;

  bodyFirstLineIndentCm: number;
  bodyAlign: Alignment;

  signatureIndentCm: number;
  signatureSpaceLines: number;
  signerNameInParentheses: boolean;

  dateStyle: DateStyle;
  thaiDigits: boolean;

  requiredFields: FieldKey[];

  /** ข้อความเริ่มต้นที่เติมให้เมื่อสร้างเอกสารใหม่ด้วยแม่แบบนี้ (เช่น ส่วนราชการ ผู้ลงนาม) */
  defaultFields: Partial<MemoFields>;
}

export interface AppSettings {
  defaultTemplateId: string;
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  field?: FieldKey;
  message: string;
  suggestion: string;
}
