import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import type { Alignment, DateStyle, MemoFields, MemoTemplate } from '../types';
import { PAGE_BREAK_MARKER } from './fields';

/**
 * อ่านบันทึกข้อความตัวอย่าง (.docx) ในเบราว์เซอร์ เพื่อ "เรียนรู้" รูปแบบและข้อความ
 * - ทำงานในเครื่องทั้งหมด ไม่ส่งไฟล์ไปที่ใด
 * - คืนเฉพาะค่าที่อ่านได้จริงจากไฟล์ ค่าที่หาไม่พบจะไม่อยู่ในผลลัพธ์ (ให้ผู้ใช้เห็นว่าใช้ค่าเดิม)
 */

const TWIPS_PER_CM = 566.929;
const twipsToCm = (v: number) => Math.round((v / TWIPS_PER_CM) * 100) / 100;

/** ค่าการจัดรูปแบบของแม่แบบที่อ่านได้จากไฟล์ */
export type LearnedSettings = Partial<
  Pick<
    MemoTemplate,
    | 'marginTopCm'
    | 'marginBottomCm'
    | 'marginLeftCm'
    | 'marginRightCm'
    | 'fontName'
    | 'fontSizePt'
    | 'lineSpacing'
    | 'paragraphSpacingAfterPt'
    | 'titleText'
    | 'titleFontSizePt'
    | 'titleBold'
    | 'titleAlign'
    | 'labelBold'
    | 'dateTabCm'
    | 'continuationIndentCm'
    | 'bodyFirstLineIndentCm'
    | 'bodyAlign'
    | 'signatureIndentCm'
    | 'signatureSpaceLines'
    | 'signerNameInParentheses'
    | 'dateStyle'
    | 'thaiDigits'
  >
> & { labels?: Partial<MemoTemplate['labels']> };

export interface LearnResult {
  settings: LearnedSettings;
  /** ข้อความที่อ่านได้ในแต่ละช่อง */
  fields: Partial<MemoFields>;
  /** ข้อความวันที่ตามต้นฉบับ (กรณีแปลงเป็นวันที่ไม่ได้ เช่น เว้นวันไว้) */
  dateText?: string;
  /** ข้อสังเกต/คำเตือนภาษาไทยสำหรับแสดงผู้ใช้ */
  notes: string[];
}

export class DocxImportError extends Error {}

// ---------- อ่านคุณสมบัติจาก XML ----------

interface PProps {
  jc?: string;
  firstLine?: number;
  hanging?: number;
  left?: number;
  line?: number;
  lineRule?: string;
  after?: number;
  tabs?: number[];
  pageBreakBefore?: boolean;
}
interface RProps {
  font?: string;
  size?: number; // half-points
  bold?: boolean;
}

type El = Element;

function child(el: El | null | undefined, name: string): El | undefined {
  if (!el) return undefined;
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as El).nodeName === name) return n as El;
  }
  return undefined;
}
function children(el: El | null | undefined, name?: string): El[] {
  const out: El[] = [];
  if (!el) return out;
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!name || (n as El).nodeName === name)) out.push(n as El);
  }
  return out;
}
function attr(el: El | undefined, name: string): string | undefined {
  const v = el?.getAttribute(name);
  return v == null || v === '' ? undefined : v;
}
function num(el: El | undefined, name: string): number | undefined {
  const v = attr(el, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
/** ค่า on/off ของ Word: <w:b/> = true, <w:b w:val="0"/> = false */
function onOff(el: El | undefined): boolean | undefined {
  if (!el) return undefined;
  const v = attr(el, 'w:val');
  return !(v === '0' || v === 'false' || v === 'off');
}

function readPPr(pPr: El | undefined): PProps {
  if (!pPr) return {};
  const p: PProps = {};
  const jc = child(pPr, 'w:jc');
  if (jc) p.jc = attr(jc, 'w:val');
  const ind = child(pPr, 'w:ind');
  if (ind) {
    p.firstLine = num(ind, 'w:firstLine');
    p.hanging = num(ind, 'w:hanging');
    p.left = num(ind, 'w:left') ?? num(ind, 'w:start');
  }
  const sp = child(pPr, 'w:spacing');
  if (sp) {
    p.line = num(sp, 'w:line');
    p.lineRule = attr(sp, 'w:lineRule');
    p.after = num(sp, 'w:after');
  }
  const tabs = child(pPr, 'w:tabs');
  if (tabs) {
    p.tabs = children(tabs, 'w:tab')
      .filter((t) => attr(t, 'w:val') !== 'clear')
      .map((t) => num(t, 'w:pos'))
      .filter((v): v is number => v !== undefined);
  }
  const pbb = onOff(child(pPr, 'w:pageBreakBefore'));
  if (pbb !== undefined) p.pageBreakBefore = pbb;
  return p;
}

function readRPr(rPr: El | undefined): RProps {
  if (!rPr) return {};
  const r: RProps = {};
  const fonts = child(rPr, 'w:rFonts');
  if (fonts) r.font = attr(fonts, 'w:cs') ?? attr(fonts, 'w:ascii') ?? attr(fonts, 'w:hAnsi');
  r.size = num(child(rPr, 'w:szCs'), 'w:val') ?? num(child(rPr, 'w:sz'), 'w:val');
  const b = onOff(child(rPr, 'w:bCs')) ?? onOff(child(rPr, 'w:b'));
  if (b !== undefined) r.bold = b;
  return r;
}

function merge<T extends object>(...parts: T[]): T {
  const out = {} as T;
  for (const p of parts) for (const [k, v] of Object.entries(p)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

interface StyleSheet {
  defaultsP: PProps;
  defaultsR: RProps;
  normalId?: string;
  styles: Map<string, { basedOn?: string; p: PProps; r: RProps }>;
}

function readStyles(xml: string | undefined): StyleSheet {
  const sheet: StyleSheet = { defaultsP: {}, defaultsR: {}, styles: new Map() };
  if (!xml) return sheet;
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement as unknown as El;
  const dd = child(root, 'w:docDefaults');
  sheet.defaultsP = readPPr(child(child(dd, 'w:pPrDefault'), 'w:pPr'));
  sheet.defaultsR = readRPr(child(child(dd, 'w:rPrDefault'), 'w:rPr'));
  for (const s of children(root, 'w:style')) {
    const id = attr(s, 'w:styleId');
    if (!id) continue;
    if (attr(s, 'w:type') === 'paragraph' && attr(s, 'w:default') === '1') sheet.normalId = id;
    sheet.styles.set(id, {
      basedOn: attr(child(s, 'w:basedOn'), 'w:val'),
      p: readPPr(child(s, 'w:pPr')),
      r: readRPr(child(s, 'w:rPr')),
    });
  }
  return sheet;
}

function styleChain(sheet: StyleSheet, id: string | undefined): { p: PProps; r: RProps } {
  const chain: { p: PProps; r: RProps }[] = [];
  const seen = new Set<string>();
  let cur = id ?? sheet.normalId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const s = sheet.styles.get(cur);
    if (!s) break;
    chain.unshift(s);
    cur = s.basedOn;
  }
  return { p: merge({}, ...chain.map((c) => c.p)), r: merge({}, ...chain.map((c) => c.r)) };
}

// ---------- แปลงเอกสารเป็นรายการย่อหน้า ----------

interface Para {
  text: string;
  p: PProps;
  /** รูปแบบตัวอักษรของ run แรกที่มีข้อความ */
  firstRun: RProps;
  /** run ทั้งหมดที่มีข้อความ พร้อมความยาว (ใช้หาฟอนต์/ขนาดที่ใช้มากที่สุด) */
  runs: { r: RProps; len: number }[];
  pageBreakInside: boolean;
}

function readParagraph(pEl: El, sheet: StyleSheet): Para {
  const pPr = child(pEl, 'w:pPr');
  const styleId = attr(child(pPr, 'w:pStyle'), 'w:val');
  const st = styleChain(sheet, styleId);
  const p = merge(sheet.defaultsP, st.p, readPPr(pPr));
  const baseR = merge(sheet.defaultsR, st.r);
  let text = '';
  let pageBreakInside = false;
  const runs: { r: RProps; len: number }[] = [];
  // run อาจอยู่ใน hyperlink / smartTag / ins — เดินทุกระดับ แต่ไม่ลงไปในย่อหน้าซ้อน (กล่องข้อความ)
  const walk = (el: El) => {
    for (const c of children(el)) {
      if (c.nodeName === 'w:r') {
        const rStyle = attr(child(child(c, 'w:rPr'), 'w:rStyle'), 'w:val');
        const r = merge(baseR, rStyle ? styleChain(sheet, rStyle).r : {}, readRPr(child(c, 'w:rPr')));
        let runText = '';
        for (const t of children(c)) {
          if (t.nodeName === 'w:t') runText += t.textContent ?? '';
          else if (t.nodeName === 'w:tab') runText += '\t';
          else if (t.nodeName === 'w:br' || t.nodeName === 'w:cr') {
            if (attr(t, 'w:type') === 'page') pageBreakInside = true;
            else runText += '\n';
          }
        }
        if (runText.trim()) runs.push({ r, len: runText.trim().length });
        text += runText;
      } else if (c.nodeName !== 'w:pPr' && c.nodeName !== 'w:txbxContent' && c.nodeName !== 'w:del') {
        walk(c);
      }
    }
  };
  walk(pEl);
  return { text, p, firstRun: runs[0]?.r ?? baseR, runs, pageBreakInside };
}

// ---------- ตัวช่วยสถิติ ----------

function mostCommon<T>(values: (T | undefined)[], weights?: number[]): T | undefined {
  const count = new Map<T, number>();
  values.forEach((v, i) => {
    if (v !== undefined) count.set(v, (count.get(v) ?? 0) + (weights?.[i] ?? 1));
  });
  let best: T | undefined;
  let bestN = -1;
  for (const [v, n] of count) if (n > bestN) [best, bestN] = [v, n];
  return best;
}

function toAlignment(jc: string | undefined): Alignment | undefined {
  switch (jc) {
    case 'center':
      return 'center';
    case 'right':
    case 'end':
      return 'right';
    case 'both':
    case 'distribute':
      return 'justify';
    case 'thaiDistribute':
      return 'thaiDistribute';
    case 'left':
    case 'start':
      return 'left';
    default:
      return undefined;
  }
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const toArabic = (s: string) => s.replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)));
const MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTHS_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** แปลงวันที่ภาษาไทย เช่น "๒๓ ตุลาคม ๒๕๖๙" หรือ "23 ต.ค. 69" เป็น ISO และบอกรูปแบบที่ใช้ */
export function parseThaiDateText(text: string): { iso?: string; style?: DateStyle; thaiDigits: boolean } {
  const thaiDigits = /[๐-๙]/.test(text);
  const t = toArabic(text).replace(/\s+/g, ' ').trim();
  let month = -1;
  let style: DateStyle | undefined;
  MONTHS_FULL.forEach((m, i) => {
    if (t.includes(m)) [month, style] = [i, 'full'];
  });
  if (month < 0) {
    MONTHS_ABBR.forEach((m, i) => {
      if (t.includes(m) || t.includes(m.replace(/\./g, '. ').trim())) [month, style] = [i, 'abbr'];
    });
  }
  const nums = t.match(/\d+/g) ?? [];
  if (month < 0) return { thaiDigits };
  const day = nums.length >= 2 ? Number(nums[0]) : undefined;
  const yearRaw = nums[nums.length - 1];
  if (!yearRaw) return { style, thaiDigits };
  if (style === 'abbr' && yearRaw.length === 2) style = 'abbrShortYear';
  let be = Number(yearRaw);
  if (yearRaw.length === 2) be += 2500;
  const ce = be - 543;
  if (!day || day < 1 || day > 31) return { style, thaiDigits };
  const iso = `${ce}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const d = new Date(Date.UTC(ce, month, day));
  if (d.getUTCMonth() !== month) return { style, thaiDigits };
  return { iso, style, thaiDigits };
}

// ---------- ตัวอ่านหลัก ----------

const LABEL_RE = /^\s*(ส่วนราชการ|ที่|เรื่อง|เรียน|อ้างถึง|สิ่งที่ส่งมาด้วย)(?=[\s\t:]|$)\s*:?\s*/;
const TITLE_RE = /^บันทึกข้อความ$/;

export async function learnFromDocx(data: ArrayBuffer | Uint8Array | Blob): Promise<LearnResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new DocxImportError('ไฟล์นี้ไม่ใช่ไฟล์ .docx ที่อ่านได้ — ถ้าเป็นไฟล์ .doc แบบเก่า ให้เปิดใน Word แล้ว "บันทึกเป็น" .docx ก่อน');
  }
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new DocxImportError('ไม่พบเนื้อหาเอกสารในไฟล์ (word/document.xml) — ไฟล์อาจเสียหาย');
  const sheet = readStyles(await zip.file('word/styles.xml')?.async('string'));

  const doc = new DOMParser().parseFromString(docXml, 'text/xml');
  const body = child(doc.documentElement as unknown as El, 'w:body');
  if (!body) throw new DocxImportError('โครงสร้างไฟล์ไม่ถูกต้อง (ไม่พบส่วน body)');

  const notes: string[] = [];
  const settings: LearnedSettings = {};
  const fields: Partial<MemoFields> = {};
  const labels: Partial<MemoTemplate['labels']> = {};

  // ระยะขอบ: ใช้ sectPr สุดท้าย (ส่วนของเอกสารหลัก)
  const sectPr = child(body, 'w:sectPr');
  const pgMar = child(sectPr, 'w:pgMar');
  if (pgMar) {
    const top = num(pgMar, 'w:top');
    const bottom = num(pgMar, 'w:bottom');
    const left = num(pgMar, 'w:left');
    const right = num(pgMar, 'w:right');
    if (top !== undefined) settings.marginTopCm = twipsToCm(Math.abs(top));
    if (bottom !== undefined) settings.marginBottomCm = twipsToCm(Math.abs(bottom));
    if (left !== undefined) settings.marginLeftCm = twipsToCm(left);
    if (right !== undefined) settings.marginRightCm = twipsToCm(right);
  }
  const pgSz = child(sectPr, 'w:pgSz');
  const w = num(pgSz, 'w:w');
  if (w && Math.abs(w - 11906) > 60) notes.push('ขนาดกระดาษในไฟล์ไม่ใช่ A4 — โปรแกรมรองรับเฉพาะ A4 จะใช้ A4 แทน');

  const paras: Para[] = [];
  for (const el of children(body)) {
    if (el.nodeName === 'w:p') paras.push(readParagraph(el, sheet));
    else if (el.nodeName === 'w:tbl') notes.push('พบตารางในไฟล์ — การเรียนรู้ระดับนี้ไม่รองรับตาราง ข้อความในตารางจะไม่ถูกนำมาใช้');
  }
  if (docXml.includes('<w:drawing') || docXml.includes('<w:pict')) {
    notes.push('พบรูปภาพในไฟล์ (เช่น ตราครุฑ) — แม่แบบที่สร้างจะไม่มีรูปภาพ ต้องเพิ่มเองใน Word หลังส่งออก');
  }
  if (!paras.some((p) => p.text.trim())) throw new DocxImportError('ไม่พบข้อความในไฟล์');

  // ฟอนต์/ขนาด/ระยะบรรทัด/ระยะหลังย่อหน้า: ค่าที่ใช้มากที่สุด (ถ่วงน้ำหนักตามความยาวข้อความ)
  const allRuns = paras.flatMap((p) => p.runs);
  const font = mostCommon(allRuns.map((r) => r.r.font), allRuns.map((r) => r.len));
  if (font) settings.fontName = font;
  else notes.push('ไม่พบชื่อฟอนต์ที่กำหนดไว้โดยตรงในไฟล์ (อาจใช้ฟอนต์จากธีม) — ใช้ชื่อฟอนต์เดิมของแม่แบบ');
  const textParas = paras.filter((p) => p.text.trim());

  // หัวเอกสาร
  let i = 0;
  while (i < paras.length && !paras[i].text.trim()) i++;
  const titlePara = paras[i];
  if (titlePara && TITLE_RE.test(titlePara.text.replace(/\s+/g, ''))) {
    settings.titleText = titlePara.text.trim();
    if (titlePara.firstRun.size) settings.titleFontSizePt = titlePara.firstRun.size / 2;
    if (titlePara.firstRun.bold !== undefined) settings.titleBold = titlePara.firstRun.bold;
    const a = toAlignment(titlePara.p.jc);
    if (a) settings.titleAlign = a;
    i++;
  } else {
    notes.push('ไม่พบหัวเอกสาร “บันทึกข้อความ” ในย่อหน้าแรก — ใช้ค่าหัวเอกสารเดิมของแม่แบบ');
  }

  // ส่วนหัว: อ่านทีละย่อหน้าจนกว่าจะเริ่มเนื้อหา
  type Multi = 'reference' | 'enclosures';
  let lastMulti: Multi | null = null;
  let labelBoldVotes: boolean[] = [];
  const contIndents: number[] = [];
  for (; i < paras.length; i++) {
    const para = paras[i];
    const raw = para.text;
    if (!raw.trim()) {
      lastMulti = null;
      continue;
    }
    const m = LABEL_RE.exec(raw);
    if (m) {
      const label = m[1];
      const rest = raw.slice(m[0].length);
      if (para.firstRun.bold !== undefined) labelBoldVotes.push(para.firstRun.bold);
      lastMulti = null;
      if (label === 'ส่วนราชการ') {
        labels.department = label;
        fields.department = rest.replace(/\t+/g, ' ').trim();
      } else if (label === 'ที่') {
        labels.docNumber = label;
        const dm = /^(.*?)[\s\t]*วันที่[\s\t]*(.*)$/.exec(rest);
        if (dm) {
          fields.docNumber = dm[1].replace(/\t+/g, ' ').trim();
          labels.date = 'วันที่';
          const dateText = dm[2].replace(/\t+/g, ' ').trim();
          const parsed = parseThaiDateText(dateText);
          if (parsed.iso) fields.date = parsed.iso;
          else if (dateText) notes.push(`อ่านวันที่ “${dateText}” เป็นวันที่ที่ครบถ้วนไม่ได้ — ช่องวันที่จะเว้นว่างไว้`);
          if (parsed.style) settings.dateStyle = parsed.style;
          settings.thaiDigits = parsed.thaiDigits || /[๐-๙]/.test(fields.docNumber);
          if (raw.includes('\t') && para.p.tabs?.length) {
            settings.dateTabCm = twipsToCm(Math.max(...para.p.tabs) - (para.p.left ?? 0));
          } else if (raw.includes('\t')) {
            notes.push('“วันที่” ถูกจัดตำแหน่งด้วยแท็บมาตรฐานของ Word ซึ่งไม่ได้ระบุตำแหน่งไว้ — ใช้ตำแหน่งเดิมของแม่แบบ ควรตรวจในหน้าแม่แบบ');
          } else {
            notes.push('“วันที่” ถูกจัดตำแหน่งด้วยการเคาะเว้นวรรค — ใช้ตำแหน่งเดิมของแม่แบบ ควรตรวจในหน้าแม่แบบ');
          }
        } else {
          fields.docNumber = rest.replace(/\t+/g, ' ').trim();
        }
      } else if (label === 'เรื่อง') {
        labels.subject = label;
        fields.subject = rest.replace(/\t+/g, ' ').trim();
      } else if (label === 'เรียน') {
        labels.to = label;
        fields.to = rest.replace(/\t+/g, ' ').trim();
      } else if (label === 'อ้างถึง' || label === 'สิ่งที่ส่งมาด้วย') {
        const key: Multi = label === 'อ้างถึง' ? 'reference' : 'enclosures';
        labels[key] = label;
        fields[key] = rest.replace(/\t+/g, ' ').trim();
        lastMulti = key;
      }
      continue;
    }
    // บรรทัดต่อของ อ้างถึง/สิ่งที่ส่งมาด้วย: เยื้องซ้ายและไม่มีย่อหน้าบรรทัดแรก
    const isContinuation = lastMulti && (para.p.left ?? 0) > 0 && !(para.p.firstLine && para.p.firstLine > 0);
    // เว้นวรรค/แท็บนำหน้าตามด้วยตัวเลข เช่น "\t๒. รายชื่อ" ก็ถือเป็นบรรทัดต่อ (ย่อหน้าเนื้อหาที่กดแท็บนำหน้าไม่นับ)
    if (lastMulti && (isContinuation || /^[\s\t]+[0-9๐-๙]/.test(raw))) {
      fields[lastMulti] = `${fields[lastMulti]}\n${raw.replace(/\t+/g, ' ').trim()}`;
      if (para.p.left) contIndents.push(para.p.left);
      continue;
    }
    break; // เริ่มเนื้อหา
  }
  if (contIndents.length) settings.continuationIndentCm = twipsToCm(mostCommon(contIndents)!);
  if (labelBoldVotes.length) settings.labelBold = labelBoldVotes.filter(Boolean).length >= labelBoldVotes.length / 2;
  if (!fields.subject && !fields.to) {
    notes.push('ไม่พบป้าย “เรื่อง” หรือ “เรียน” ในไฟล์ — ไฟล์นี้อาจไม่ใช่บันทึกข้อความ หรือใช้ป้ายที่ต่างออกไป ผลการอ่านอาจไม่ครบ');
  }
  const bodyStart = i;

  // กลุ่มลงนาม: ไล่จากท้ายเอกสาร หาย่อหน้าที่จัดกึ่งกลางหรือเยื้องมาก
  let end = paras.length - 1;
  while (end >= bodyStart && !paras[end].text.trim()) end--;
  let sigStart = end + 1;
  for (let k = end; k >= bodyStart; k--) {
    const p = paras[k];
    if (!p.text.trim()) break;
    const isSig = p.p.jc === 'center' || (p.p.left ?? 0) >= 3 * TWIPS_PER_CM;
    if (!isSig || (p.p.firstLine ?? 0) > 0) break;
    sigStart = k;
  }
  const sigParas = paras.slice(sigStart, end + 1);
  if (sigParas.length) {
    const nameIdx = sigParas.findIndex((p) => /^\s*\(.*\)\s*$/.test(p.text));
    const idx = nameIdx >= 0 ? nameIdx : 0;
    const namePara = sigParas[idx];
    const nameText = namePara.text.trim();
    settings.signerNameInParentheses = nameIdx >= 0;
    fields.signerName = nameIdx >= 0 ? nameText.replace(/^\(\s*|\s*\)$/g, '') : nameText;
    const pos = sigParas.slice(idx + 1).map((p) => p.text.trim());
    if (pos.length) fields.signerPosition = pos.join('\n');
    settings.signatureIndentCm = twipsToCm(namePara.p.left ?? 0);
    if (namePara.p.jc !== 'center') {
      notes.push('ต้นฉบับจัดชื่อผู้ลงนามแบบชิดซ้ายที่ระยะเยื้อง — แม่แบบจะจัดกึ่งกลางของพื้นที่ทางขวาของระยะเยื้อง ควรตรวจในตัวอย่าง');
    }
    let blanks = 0;
    for (let k = sigStart - 1; k >= bodyStart && !paras[k].text.trim(); k--) blanks++;
    settings.signatureSpaceLines = Math.min(10, blanks);
  } else {
    notes.push('ไม่พบกลุ่มลงนามท้ายเอกสาร (ย่อหน้าที่จัดกึ่งกลางหรือเยื้องขวา) — ใช้ค่าตำแหน่งลงนามเดิมของแม่แบบ');
  }

  // เนื้อหาและคำลงท้าย
  let bodyEnd = sigStart - 1;
  while (bodyEnd >= bodyStart && !paras[bodyEnd].text.trim()) bodyEnd--;
  const bodyParas = paras.slice(bodyStart, bodyEnd + 1);
  const lastText = bodyParas.length ? bodyParas[bodyParas.length - 1].text.trim() : '';
  let mainParas = bodyParas;
  if (/^จึง/.test(lastText)) {
    fields.closing = lastText;
    mainParas = bodyParas.slice(0, -1);
  }
  const lines: string[] = [];
  for (const p of mainParas) {
    if (p.p.pageBreakBefore && lines.length) lines.push(PAGE_BREAK_MARKER);
    lines.push(p.text.replace(/\t+/g, ' ').trim());
    if (p.pageBreakInside) lines.push(PAGE_BREAK_MARKER);
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  if (lines.length) fields.body = lines.join('\n');

  const bodyTextParas = bodyParas.filter((p) => p.text.trim());
  const firstLines = bodyTextParas.map((p) => (p.p.firstLine ? p.p.firstLine : undefined));
  const fl = mostCommon(firstLines);
  if (fl !== undefined) settings.bodyFirstLineIndentCm = twipsToCm(fl);
  else if (bodyTextParas.some((p) => /^\t/.test(p.text))) {
    notes.push('ต้นฉบับใช้การกดแท็บนำหน้าย่อหน้าแทนการตั้งค่าย่อหน้า — ใช้ระยะย่อหน้าเดิมของแม่แบบ ควรตรวจในหน้าแม่แบบ');
  }
  const ba = mostCommon(bodyTextParas.map((p) => toAlignment(p.p.jc)));
  if (ba) settings.bodyAlign = ba;

  // ขนาดตัวอักษรเนื้อหา, ระยะบรรทัด, ระยะหลังย่อหน้า (ไม่นับหัวเอกสาร)
  const contentRuns = textParas.filter((p) => p !== titlePara || !settings.titleText).flatMap((p) => p.runs);
  const size = mostCommon(contentRuns.map((r) => r.r.size), contentRuns.map((r) => r.len));
  if (size) settings.fontSizePt = size / 2;
  const contentParas = textParas.filter((p) => p !== titlePara);
  // ถ้าไม่ระบุระยะบรรทัดไว้เลย Word ถือว่าเป็นบรรทัดเดี่ยว (240 = 1 เท่า)
  const lineVals = contentParas.map((p) =>
    p.p.lineRule === undefined || p.p.lineRule === 'auto' ? Math.round(((p.p.line ?? 240) / 240) * 100) / 100 : undefined,
  );
  const ls = mostCommon(lineVals);
  if (ls !== undefined) settings.lineSpacing = ls;
  if (contentParas.some((p) => p.p.lineRule === 'exact' || p.p.lineRule === 'atLeast')) {
    notes.push('ต้นฉบับกำหนดระยะบรรทัดแบบ “ค่าตายตัว” ซึ่งแม่แบบยังไม่รองรับ — ใช้ระยะบรรทัดแบบเท่าของบรรทัดแทน ควรตรวจในไฟล์ที่ส่งออก');
  }
  const after = mostCommon(contentParas.map((p) => p.p.after));
  if (after !== undefined) settings.paragraphSpacingAfterPt = Math.round((after / 20) * 10) / 10;

  if (Object.keys(labels).length) settings.labels = labels;
  return { settings, fields, notes };
}
