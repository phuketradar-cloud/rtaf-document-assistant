import type { FieldKey, MemoFields } from '../types';

export const FIELD_KEYS: FieldKey[] = [
  'department',
  'docNumber',
  'date',
  'subject',
  'to',
  'reference',
  'enclosures',
  'body',
  'closing',
  'signerName',
  'signerPosition',
];

/** ชื่อช่องที่แสดงในหน้าจอ */
export const FIELD_LABELS: Record<FieldKey, string> = {
  department: 'ส่วนราชการ',
  docNumber: 'ที่',
  date: 'วันที่',
  subject: 'เรื่อง',
  to: 'เรียน',
  reference: 'อ้างถึง',
  enclosures: 'สิ่งที่ส่งมาด้วย',
  body: 'เนื้อหา',
  closing: 'ข้อเสนอหรือคำลงท้าย',
  signerName: 'ผู้ลงนาม',
  signerPosition: 'ตำแหน่งผู้ลงนาม',
};

/** บรรทัดที่ผู้ใช้พิมพ์ในเนื้อหาเพื่อขึ้นหน้าใหม่ */
export const PAGE_BREAK_MARKER = '[[ขึ้นหน้าใหม่]]';

export function emptyFields(): MemoFields {
  const f = {} as MemoFields;
  for (const k of FIELD_KEYS) f[k] = '';
  return f;
}

/** เติมช่องที่ขาดและตัดค่าที่ไม่ใช่ข้อความ (ใช้ตอนโหลด/นำเข้าข้อมูล) */
export function normalizeFields(input: unknown): MemoFields {
  const f = emptyFields();
  if (input && typeof input === 'object') {
    for (const k of FIELD_KEYS) {
      const v = (input as Record<string, unknown>)[k];
      if (typeof v === 'string') f[k] = v;
    }
  }
  return f;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
