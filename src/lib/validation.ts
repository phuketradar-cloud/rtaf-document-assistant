import type { DocumentRecord, FieldKey, MemoFields, MemoTemplate, ValidationIssue } from '../types';
import { FIELD_KEYS, FIELD_LABELS, PAGE_BREAK_MARKER } from './fields';
import { parseIsoDate, todayIso } from './thaiDate';

/**
 * คำที่มักสะกดผิด → คำที่ถูกต้อง (ตรวจเบื้องต้นเท่านั้น ไม่ใช่พจนานุกรมสมบูรณ์)
 * ระบบจะแจ้งเตือนเท่านั้น ไม่แก้ไขข้อความให้อัตโนมัติ
 */
export const COMMON_MISSPELLINGS: Record<string, string> = {
  'อนุญาติ': 'อนุญาต',
  'ปฎิบัติ': 'ปฏิบัติ',
  'กฏหมาย': 'กฎหมาย',
  'กฏระเบียบ': 'กฎระเบียบ',
  'บุคคลากร': 'บุคลากร',
  'โอกาศ': 'โอกาส',
  'สังเกตุ': 'สังเกต',
  'ผลลัพท์': 'ผลลัพธ์',
  'ลายเซ็นต์': 'ลายเซ็น',
  'ศรีษะ': 'ศีรษะ',
  'อีเมล์': 'อีเมล',
  'คลินิค': 'คลินิก',
  'ผาสุข': 'ผาสุก',
  'ศักย์ภาพ': 'ศักยภาพ',
  'ประสิทธิภาพภาพ': 'ประสิทธิภาพ',
  'พิจรณา': 'พิจารณา',
  'อนุมัด': 'อนุมัติ',
};

const TEXT_FIELDS: FieldKey[] = FIELD_KEYS.filter((k) => k !== 'date');

interface ValidateOptions {
  /** เอกสารอื่นในระบบ (ใช้ตรวจเลขที่หนังสือซ้ำ) */
  otherDocuments?: DocumentRecord[];
  /** วันที่อ้างอิงสำหรับการตรวจ (ค่าเริ่มต้น = วันนี้) */
  today?: string;
}

function daysBetween(aIso: string, bIso: string): number {
  const a = parseIsoDate(aIso)!;
  const b = parseIsoDate(bIso)!;
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000);
}

export function validateMemo(fields: MemoFields, t: MemoTemplate, opts: ValidateOptions = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (i: Omit<ValidationIssue, 'id'>) => issues.push({ ...i, id: `${i.field ?? 'doc'}-${issues.length}` });
  const label = (k: FieldKey) => `“${FIELD_LABELS[k]}”`;

  // 1) ช่องที่จำเป็นแต่ยังว่าง
  for (const k of t.requiredFields) {
    if (!fields[k].trim()) {
      add({
        severity: 'error',
        field: k,
        message: `ยังไม่ได้กรอก ${label(k)}`,
        suggestion: `กรอกข้อมูลในช่อง ${label(k)} หรือถ้าเอกสารประเภทนี้ไม่ต้องมี ให้นำช่องนี้ออกจาก “ช่องที่จำเป็น” ในหน้าแม่แบบ`,
      });
    }
  }

  // 2) รูปแบบวันที่และความสมเหตุสมผล
  const date = fields.date.trim();
  if (date) {
    const p = parseIsoDate(date);
    if (!p) {
      add({
        severity: 'error',
        field: 'date',
        message: 'รูปแบบวันที่ไม่ถูกต้องหรือเป็นวันที่ที่ไม่มีอยู่จริง',
        suggestion: 'เลือกวันที่จากปฏิทินในช่อง “วันที่” อีกครั้ง',
      });
    } else {
      const today = opts.today ?? todayIso();
      const diff = daysBetween(today, date);
      if (p.year < 1950 || p.year > 2200) {
        add({
          severity: 'error',
          field: 'date',
          message: `ปีของวันที่ (ค.ศ. ${p.year}) อยู่นอกช่วงที่เป็นไปได้`,
          suggestion: 'ตรวจว่าไม่ได้กรอกปี พ.ศ. ลงในปฏิทินที่ใช้ ค.ศ. — ปฏิทินในช่องวันที่ใช้ปี ค.ศ.',
        });
      } else if (diff > 30) {
        add({
          severity: 'warning',
          field: 'date',
          message: `วันที่ในเอกสารอยู่ล่วงหน้า ${diff} วันจากวันนี้`,
          suggestion: 'ตรวจสอบว่าตั้งใจลงวันที่ล่วงหน้าหรือไม่ โปรแกรมจะไม่เปลี่ยนวันที่ให้',
        });
      } else if (diff < -365) {
        add({
          severity: 'warning',
          field: 'date',
          message: `วันที่ในเอกสารย้อนหลังมากกว่า 1 ปี (${-diff} วัน)`,
          suggestion: 'ถ้าเป็นเอกสารที่ทำสำเนามา โปรดตรวจและแก้ไขวันที่ด้วยตนเอง',
        });
      }
    }
  }

  // 3) ความสอดคล้องของข้อมูล
  const mainText = `${fields.body}\n${fields.closing}`;
  if (!fields.reference.trim() && /อ้างถึง/.test(mainText)) {
    add({
      severity: 'warning',
      field: 'reference',
      message: 'เนื้อหากล่าวถึง “อ้างถึง” แต่ช่องอ้างถึงยังว่าง',
      suggestion: 'กรอกช่อง “อ้างถึง” หรือตรวจข้อความในเนื้อหา',
    });
  }
  if (!fields.enclosures.trim() && /สิ่งที่ส่งมาด้วย/.test(mainText)) {
    add({
      severity: 'warning',
      field: 'enclosures',
      message: 'เนื้อหากล่าวถึง “สิ่งที่ส่งมาด้วย” แต่ช่องสิ่งที่ส่งมาด้วยยังว่าง',
      suggestion: 'กรอกช่อง “สิ่งที่ส่งมาด้วย” หรือตรวจข้อความในเนื้อหา',
    });
  }
  if (fields.signerName.trim() && !fields.signerPosition.trim() && !t.requiredFields.includes('signerPosition')) {
    add({
      severity: 'warning',
      field: 'signerPosition',
      message: 'มีชื่อผู้ลงนามแต่ไม่มีตำแหน่ง',
      suggestion: 'กรอก “ตำแหน่งผู้ลงนาม” ถ้าเอกสารต้องระบุตำแหน่ง',
    });
  }
  if (fields.signerPosition.trim() && !fields.signerName.trim() && !t.requiredFields.includes('signerName')) {
    add({
      severity: 'warning',
      field: 'signerName',
      message: 'มีตำแหน่งผู้ลงนามแต่ไม่มีชื่อ',
      suggestion: 'กรอก “ผู้ลงนาม”',
    });
  }
  if (/^\(.*\)$/.test(fields.signerName.trim()) && t.signerNameInParentheses) {
    add({
      severity: 'warning',
      field: 'signerName',
      message: 'ชื่อผู้ลงนามมีวงเล็บอยู่แล้ว และแม่แบบจะใส่วงเล็บให้อีกชั้น',
      suggestion: 'ลบวงเล็บออกจากชื่อ หรือปิดตัวเลือก “ใส่วงเล็บชื่อผู้ลงนาม” ในแม่แบบ',
    });
  }
  const docNo = fields.docNumber.trim();
  if (docNo && /[0-9]/.test(docNo) && /[๐-๙]/.test(docNo)) {
    add({
      severity: 'warning',
      field: 'docNumber',
      message: 'เลขที่หนังสือใช้เลขไทยและเลขอารบิกปะปนกัน',
      suggestion: 'เลือกใช้ตัวเลขแบบเดียวกันทั้งเลขที่ (โปรแกรมจะไม่แก้ไขเลขที่ให้)',
    });
  }
  if (docNo && opts.otherDocuments) {
    const dup = opts.otherDocuments.find((d) => d.fields.docNumber.trim() === docNo);
    if (dup) {
      add({
        severity: 'warning',
        field: 'docNumber',
        message: `เลขที่หนังสือซ้ำกับเอกสารอื่น (เรื่อง: ${dup.fields.subject.trim() || 'ไม่มีชื่อเรื่อง'})`,
        suggestion: 'ตรวจว่าเป็นเลขที่ที่ถูกต้อง โดยเฉพาะเอกสารที่ทำสำเนามา',
      });
    }
  }
  const usesThaiDigits = TEXT_FIELDS.some((k) => /[๐-๙]/.test(fields[k])) || (t.thaiDigits && !!date);
  const usesArabicDigits = TEXT_FIELDS.some((k) => /[0-9]/.test(fields[k])) || (!t.thaiDigits && !!date);
  if (usesThaiDigits && usesArabicDigits) {
    add({
      severity: 'info',
      message: 'เอกสารนี้มีทั้งเลขไทยและเลขอารบิก',
      suggestion: 'ถ้าหน่วยกำหนดให้ใช้ตัวเลขแบบใดแบบหนึ่ง โปรดตรวจและแก้ไขด้วยตนเอง (รวมถึงตัวเลือก “ใช้เลขไทยในวันที่” ของแม่แบบ)',
    });
  }

  // 4) ข้อความซ้ำ
  for (const k of ['body', 'closing'] as FieldKey[]) {
    const seen = new Map<string, number>();
    fields[k].split(/\r?\n/).forEach((line, idx) => {
      const s = line.trim();
      if (s.length < 10 || s === PAGE_BREAK_MARKER) return;
      if (seen.has(s)) {
        add({
          severity: 'warning',
          field: k,
          message: `${label(k)} บรรทัดที่ ${idx + 1} ซ้ำกับบรรทัดที่ ${seen.get(s)! + 1}`,
          suggestion: 'ตรวจว่าคัดลอกข้อความซ้ำโดยไม่ตั้งใจหรือไม่',
        });
      } else seen.set(s, idx);
    });
  }
  for (const k of TEXT_FIELDS) {
    const m = /(^|\s)(\S+)\s+\2(?=\s|$)/.exec(fields[k]);
    if (m) {
      add({
        severity: 'warning',
        field: k,
        message: `${label(k)} มีคำซ้ำติดกัน: “${m[2]} ${m[2]}”`,
        suggestion: 'ลบคำที่ซ้ำออกถ้าพิมพ์ซ้ำโดยไม่ตั้งใจ',
      });
    }
    if (/[^\S\n]{3,}/.test(fields[k].replace(/^[^\S\n]+/gm, ''))) {
      add({
        severity: 'info',
        field: k,
        message: `${label(k)} มีช่องว่างติดกันหลายช่อง`,
        suggestion: 'ใช้การตั้งค่าย่อหน้าในแม่แบบแทนการเคาะเว้นวรรคหลายครั้ง เพื่อให้จัดหน้าใน Word ได้ถูกต้อง',
      });
    }
  }

  // 5) คำผิดเบื้องต้น
  for (const k of TEXT_FIELDS) {
    for (const [wrong, right] of Object.entries(COMMON_MISSPELLINGS)) {
      if (fields[k].includes(wrong)) {
        add({
          severity: 'warning',
          field: k,
          message: `${label(k)} อาจสะกดผิด: “${wrong}”`,
          suggestion: `อาจหมายถึง “${right}” — โปรดตรวจและแก้ไขด้วยตนเอง (โปรแกรมไม่แก้ให้อัตโนมัติ)`,
        });
      }
    }
    const open = (fields[k].match(/\(/g) ?? []).length;
    const close = (fields[k].match(/\)/g) ?? []).length;
    if (open !== close) {
      add({
        severity: 'info',
        field: k,
        message: `${label(k)} มีวงเล็บเปิดและปิดไม่เท่ากัน`,
        suggestion: 'ตรวจว่าวงเล็บครบคู่',
      });
    }
  }

  return issues;
}

export function countBySeverity(issues: ValidationIssue[]) {
  return {
    error: issues.filter((i) => i.severity === 'error').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };
}
