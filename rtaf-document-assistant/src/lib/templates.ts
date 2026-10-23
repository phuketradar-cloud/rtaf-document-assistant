import type { Alignment, DateStyle, FieldKey, LabelKey, MemoTemplate } from '../types';
import { FIELD_KEYS } from './fields';

export const BUILTIN_TEMPLATE_ID = 'builtin-memo-v1';

const DEFAULT_LABELS: Record<LabelKey, string> = {
  department: 'ส่วนราชการ',
  docNumber: 'ที่',
  date: 'วันที่',
  subject: 'เรื่อง',
  to: 'เรียน',
  reference: 'อ้างถึง',
  enclosures: 'สิ่งที่ส่งมาด้วย',
};

/**
 * แม่แบบเริ่มต้นของโปรแกรม — ค่าต่าง ๆ เป็นค่าตั้งต้นจากผู้พัฒนาเท่านั้น
 * ยังไม่ได้ตรวจสอบเทียบกับระเบียบงานสารบรรณหรือแบบฟอร์มของหน่วยใด
 */
export const BUILTIN_TEMPLATE: MemoTemplate = {
  id: BUILTIN_TEMPLATE_ID,
  name: 'บันทึกข้อความ (ค่าเริ่มต้นของโปรแกรม)',
  description: 'ค่าตั้งต้นสำหรับเริ่มใช้งาน ควรทำสำเนาแล้วปรับให้ตรงกับไฟล์ต้นฉบับของหน่วย',
  sourceNote: 'ยังไม่มีแหล่งอ้างอิง — ค่าตั้งต้นจากผู้พัฒนา ยังไม่ได้ตรวจสอบกับระเบียบ',
  builtIn: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',

  marginTopCm: 2.5,
  marginBottomCm: 2,
  marginLeftCm: 3,
  marginRightCm: 2,

  fontName: 'TH Sarabun New',
  fontSizePt: 16,
  lineSpacing: 1,
  paragraphSpacingAfterPt: 0,

  titleText: 'บันทึกข้อความ',
  titleFontSizePt: 29,
  titleBold: true,
  titleAlign: 'center',

  labels: { ...DEFAULT_LABELS },
  labelBold: true,
  dateTabCm: 8,
  continuationIndentCm: 2.5,

  bodyFirstLineIndentCm: 2.5,
  bodyAlign: 'thaiDistribute',

  signatureIndentCm: 7,
  signatureSpaceLines: 3,
  signerNameInParentheses: true,

  dateStyle: 'full',
  thaiDigits: false,

  requiredFields: ['department', 'docNumber', 'date', 'subject', 'to', 'body', 'signerName', 'signerPosition'],
};

const ALIGNMENTS: Alignment[] = ['left', 'center', 'right', 'justify', 'thaiDistribute'];
const DATE_STYLES: DateStyle[] = ['full', 'abbr', 'abbrShortYear'];

export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  left: 'ชิดซ้าย',
  center: 'กึ่งกลาง',
  right: 'ชิดขวา',
  justify: 'เต็มบรรทัด',
  thaiDistribute: 'กระจายแบบไทย',
};

export const DATE_STYLE_LABELS: Record<DateStyle, string> = {
  full: 'เต็ม (เช่น 1 มกราคม 2570)',
  abbr: 'ย่อเดือน (เช่น 1 ม.ค. 2570)',
  abbrShortYear: 'ย่อเดือนและปี (เช่น 1 ม.ค. 70)',
};

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}
function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** ตรวจและเติมค่าที่ขาดของแม่แบบ (ใช้ตอนโหลด/นำเข้า) — ค่าที่ไม่ถูกต้องจะใช้ค่าตั้งต้นแทน */
export function normalizeTemplate(input: unknown): MemoTemplate | null {
  if (!input || typeof input !== 'object') return null;
  const t = input as Record<string, unknown>;
  if (typeof t.id !== 'string' || !t.id) return null;
  const d = BUILTIN_TEMPLATE;
  const labelsIn = (t.labels && typeof t.labels === 'object' ? t.labels : {}) as Record<string, unknown>;
  const labels = { ...DEFAULT_LABELS };
  for (const k of Object.keys(DEFAULT_LABELS) as LabelKey[]) labels[k] = str(labelsIn[k], DEFAULT_LABELS[k]);
  const required = Array.isArray(t.requiredFields)
    ? (t.requiredFields.filter((k) => FIELD_KEYS.includes(k as FieldKey)) as FieldKey[])
    : [...d.requiredFields];
  return {
    id: t.id,
    name: str(t.name, 'แม่แบบไม่มีชื่อ') || 'แม่แบบไม่มีชื่อ',
    description: str(t.description, ''),
    sourceNote: str(t.sourceNote, ''),
    builtIn: false,
    createdAt: str(t.createdAt, new Date().toISOString()),
    updatedAt: str(t.updatedAt, new Date().toISOString()),
    marginTopCm: num(t.marginTopCm, d.marginTopCm, 0, 10),
    marginBottomCm: num(t.marginBottomCm, d.marginBottomCm, 0, 10),
    marginLeftCm: num(t.marginLeftCm, d.marginLeftCm, 0, 10),
    marginRightCm: num(t.marginRightCm, d.marginRightCm, 0, 10),
    fontName: str(t.fontName, d.fontName).trim() || d.fontName,
    fontSizePt: num(t.fontSizePt, d.fontSizePt, 6, 72),
    lineSpacing: num(t.lineSpacing, d.lineSpacing, 0.5, 4),
    paragraphSpacingAfterPt: num(t.paragraphSpacingAfterPt, d.paragraphSpacingAfterPt, 0, 72),
    titleText: str(t.titleText, d.titleText),
    titleFontSizePt: num(t.titleFontSizePt, d.titleFontSizePt, 6, 96),
    titleBold: bool(t.titleBold, d.titleBold),
    titleAlign: ALIGNMENTS.includes(t.titleAlign as Alignment) ? (t.titleAlign as Alignment) : d.titleAlign,
    labels,
    labelBold: bool(t.labelBold, d.labelBold),
    dateTabCm: num(t.dateTabCm, d.dateTabCm, 0, 20),
    continuationIndentCm: num(t.continuationIndentCm, d.continuationIndentCm, 0, 15),
    bodyFirstLineIndentCm: num(t.bodyFirstLineIndentCm, d.bodyFirstLineIndentCm, 0, 10),
    bodyAlign: ALIGNMENTS.includes(t.bodyAlign as Alignment) ? (t.bodyAlign as Alignment) : d.bodyAlign,
    signatureIndentCm: num(t.signatureIndentCm, d.signatureIndentCm, 0, 15),
    signatureSpaceLines: Math.round(num(t.signatureSpaceLines, d.signatureSpaceLines, 0, 10)),
    signerNameInParentheses: bool(t.signerNameInParentheses, d.signerNameInParentheses),
    dateStyle: DATE_STYLES.includes(t.dateStyle as DateStyle) ? (t.dateStyle as DateStyle) : d.dateStyle,
    thaiDigits: bool(t.thaiDigits, d.thaiDigits),
    requiredFields: required,
  };
}

/** หาแม่แบบตาม id — ถ้าไม่พบใช้แม่แบบเริ่มต้นของโปรแกรม */
export function resolveTemplate(templates: MemoTemplate[], id: string): { template: MemoTemplate; missing: boolean } {
  const found = templates.find((t) => t.id === id);
  return found ? { template: found, missing: false } : { template: BUILTIN_TEMPLATE, missing: true };
}
