import type { DateStyle } from '../types';

const MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const MONTHS_ABBR = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

export interface ParsedDate {
  year: number; // ค.ศ.
  month: number; // 1-12
  day: number;
}

/** อ่านวันที่ ISO (yyyy-mm-dd) — คืน null ถ้าไม่ใช่วันที่ที่มีอยู่จริง */
export function parseIsoDate(iso: string): ParsedDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function toThaiDigits(text: string): string {
  return text.replace(/[0-9]/g, (c) => THAI_DIGITS[Number(c)]);
}

/** แปลงวันที่ ISO เป็นวันที่แบบไทย (พ.ศ.) — ไม่แก้ไขค่าที่ผู้ใช้กรอก คืนค่าเดิมถ้าอ่านไม่ได้ */
export function formatThaiDate(iso: string, style: DateStyle, thaiDigits: boolean): string {
  if (!iso) return '';
  const p = parseIsoDate(iso);
  if (!p) return iso;
  const be = p.year + 543;
  let text: string;
  if (style === 'full') text = `${p.day} ${MONTHS_FULL[p.month - 1]} ${be}`;
  else if (style === 'abbr') text = `${p.day} ${MONTHS_ABBR[p.month - 1]} ${be}`;
  else text = `${p.day} ${MONTHS_ABBR[p.month - 1]} ${String(be).slice(-2)}`;
  return thaiDigits ? toThaiDigits(text) : text;
}

/** วันที่วันนี้ตามเวลาเครื่อง ในรูปแบบ ISO */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** แสดงเวลาบันทึก (ISO timestamp) สำหรับหน้าจอ */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const date = formatThaiDate(todayIso(d), 'abbr', false);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time} น.`;
}
