import type { FieldKey, MemoFields, MemoTemplate } from '../types';
import type { LearnedSettings } from './docxImport';
import { newId } from './fields';

/** ค่าในแม่แบบที่หน้าเรียนรู้แสดงให้ผู้ใช้ตรวจ (ลำดับตามที่แสดง) */
export const LEARNED_SETTING_LABELS: { key: Exclude<keyof LearnedSettings, 'labels'>; label: string; unit?: string }[] = [
  { key: 'marginTopCm', label: 'ระยะขอบบน', unit: 'ซม.' },
  { key: 'marginBottomCm', label: 'ระยะขอบล่าง', unit: 'ซม.' },
  { key: 'marginLeftCm', label: 'ระยะขอบซ้าย', unit: 'ซม.' },
  { key: 'marginRightCm', label: 'ระยะขอบขวา', unit: 'ซม.' },
  { key: 'fontName', label: 'ฟอนต์' },
  { key: 'fontSizePt', label: 'ขนาดตัวอักษร', unit: 'pt' },
  { key: 'lineSpacing', label: 'ระยะบรรทัด', unit: 'เท่า' },
  { key: 'paragraphSpacingAfterPt', label: 'ระยะหลังย่อหน้า', unit: 'pt' },
  { key: 'titleText', label: 'ข้อความหัวเอกสาร' },
  { key: 'titleFontSizePt', label: 'ขนาดหัวเอกสาร', unit: 'pt' },
  { key: 'titleBold', label: 'หัวเอกสารตัวหนา' },
  { key: 'titleAlign', label: 'ตำแหน่งหัวเอกสาร' },
  { key: 'labelBold', label: 'ป้ายชื่อตัวหนา' },
  { key: 'dateTabCm', label: 'ตำแหน่ง “วันที่”', unit: 'ซม.' },
  { key: 'continuationIndentCm', label: 'เยื้องบรรทัดต่อของอ้างถึง/สิ่งที่ส่งมาด้วย', unit: 'ซม.' },
  { key: 'bodyFirstLineIndentCm', label: 'ย่อหน้าบรรทัดแรก', unit: 'ซม.' },
  { key: 'bodyAlign', label: 'การจัดแนวเนื้อหา' },
  { key: 'signatureIndentCm', label: 'ระยะเยื้องกลุ่มลงนาม', unit: 'ซม.' },
  { key: 'signatureSpaceLines', label: 'บรรทัดว่างสำหรับลายมือชื่อ', unit: 'บรรทัด' },
  { key: 'signerNameInParentheses', label: 'ใส่วงเล็บชื่อผู้ลงนาม' },
  { key: 'dateStyle', label: 'รูปแบบวันที่' },
  { key: 'thaiDigits', label: 'ใช้เลขไทยในวันที่' },
];

/** ช่องที่มักใช้ซ้ำทุกฉบับ — เลือกไว้ให้ก่อน ผู้ใช้เปลี่ยนได้ */
export const REUSABLE_FIELDS: FieldKey[] = ['department', 'to', 'closing', 'signerName', 'signerPosition'];

export function templateFromLearned(
  base: MemoTemplate,
  settings: LearnedSettings,
  opts: { name: string; fileName: string; defaultFields: Partial<MemoFields> },
): MemoTemplate {
  const now = new Date().toISOString();
  const { labels, ...rest } = settings;
  return {
    ...base,
    ...rest,
    labels: { ...base.labels, ...labels },
    requiredFields: [...base.requiredFields],
    id: newId(),
    builtIn: false,
    name: opts.name,
    description: `สร้างจากไฟล์ตัวอย่าง ${opts.fileName}`,
    sourceNote: `เรียนรู้จากไฟล์ “${opts.fileName}” เมื่อ ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })} — ค่าที่อ่านไม่ได้ใช้ค่าจาก “${base.name}”`,
    defaultFields: { ...opts.defaultFields },
    createdAt: now,
    updatedAt: now,
  };
}
