import type { Alignment, FieldKey, MemoFields, MemoTemplate } from '../types';
import { PAGE_BREAK_MARKER } from './fields';
import { formatThaiDate } from './thaiDate';

/**
 * แบบจำลองการจัดวางกลาง: แปลง (ข้อมูล + แม่แบบ) เป็นรายการย่อหน้า
 * ตัวอย่างบนจอ (PreviewDocument) และไฟล์ Word (docxExport) ใช้ผลลัพธ์เดียวกันนี้
 */
export type LayoutRun = { kind: 'text'; text: string; bold?: boolean } | { kind: 'tab' };

export type LayoutRole = 'title' | 'header' | 'body' | 'signature' | 'blank';

export interface LayoutParagraph {
  role: LayoutRole;
  runs: LayoutRun[];
  align: Alignment;
  sizePt: number;
  firstLineIndentCm?: number;
  leftIndentCm?: number;
  tabStopCm?: number;
  pageBreakBefore?: boolean;
}

function text(t: string, bold = false): LayoutRun {
  return { kind: 'text', text: t, bold };
}

function splitLines(value: string): string[] {
  return value.replace(/\r\n?/g, '\n').split('\n');
}

export function buildMemoLayout(fields: MemoFields, t: MemoTemplate): LayoutParagraph[] {
  const out: LayoutParagraph[] = [];
  let pendingBreak = false;
  const push = (p: LayoutParagraph) => {
    if (pendingBreak) {
      p.pageBreakBefore = true;
      pendingBreak = false;
    }
    out.push(p);
  };
  const base = { align: 'left' as Alignment, sizePt: t.fontSizePt };
  const show = (k: FieldKey) => fields[k].trim() !== '' || t.requiredFields.includes(k);
  const label = (s: string) => text(s, t.labelBold);
  const val = (k: FieldKey) => fields[k].trim();

  if (t.titleText.trim()) {
    push({ role: 'title', runs: [text(t.titleText, t.titleBold)], align: t.titleAlign, sizePt: t.titleFontSizePt });
  }

  const simpleLine = (k: FieldKey & keyof MemoTemplate['labels']) => {
    if (!show(k)) return;
    push({ ...base, role: 'header', runs: [label(t.labels[k]), text(' ' + val(k))] });
  };

  simpleLine('department');

  const dateText = formatThaiDate(val('date'), t.dateStyle, t.thaiDigits);
  const showNo = show('docNumber');
  const showDate = show('date');
  if (showNo && showDate && t.dateTabCm > 0) {
    push({
      ...base,
      role: 'header',
      tabStopCm: t.dateTabCm,
      runs: [label(t.labels.docNumber), text(' ' + val('docNumber')), { kind: 'tab' }, label(t.labels.date), text(' ' + dateText)],
    });
  } else {
    if (showNo) push({ ...base, role: 'header', runs: [label(t.labels.docNumber), text(' ' + val('docNumber'))] });
    if (showDate) push({ ...base, role: 'header', runs: [label(t.labels.date), text(' ' + dateText)] });
  }

  simpleLine('subject');
  simpleLine('to');

  const multiLine = (k: 'reference' | 'enclosures') => {
    if (!show(k)) return;
    const lines = splitLines(val(k));
    push({ ...base, role: 'header', runs: [label(t.labels[k]), text(' ' + lines[0])] });
    for (const line of lines.slice(1)) {
      push({ ...base, role: 'header', leftIndentCm: t.continuationIndentCm, runs: [text(line)] });
    }
  };
  multiLine('reference');
  multiLine('enclosures');

  const paragraphs = (value: string) => {
    for (const line of splitLines(value)) {
      if (line.trim() === PAGE_BREAK_MARKER) {
        pendingBreak = true;
        continue;
      }
      if (line.trim() === '') {
        push({ ...base, role: 'blank', runs: [] });
        continue;
      }
      push({
        ...base,
        role: 'body',
        align: t.bodyAlign,
        firstLineIndentCm: t.bodyFirstLineIndentCm,
        runs: [text(line.trim())],
      });
    }
  };
  if (show('body')) paragraphs(fields.body.replace(/^\s*\n|\n\s*$/g, ''));
  if (show('closing') && val('closing')) paragraphs(fields.closing.replace(/^\s*\n|\n\s*$/g, ''));

  const showName = show('signerName');
  const showPos = show('signerPosition');
  if (showName || showPos) {
    for (let i = 0; i < t.signatureSpaceLines; i++) push({ ...base, role: 'blank', runs: [] });
    const sig = { ...base, role: 'signature' as LayoutRole, align: 'center' as Alignment, leftIndentCm: t.signatureIndentCm };
    if (showName) {
      const name = val('signerName');
      push({ ...sig, runs: [text(t.signerNameInParentheses ? `(${name})` : name)] });
    }
    if (showPos) {
      for (const line of splitLines(val('signerPosition'))) push({ ...sig, runs: [text(line.trim())] });
    }
  }

  // ตัวแบ่งหน้าที่อยู่ท้ายสุด: เพิ่มย่อหน้าว่างบนหน้าใหม่เพื่อให้การขึ้นหน้าใหม่เกิดขึ้นจริง
  if (pendingBreak) push({ ...base, role: 'blank', runs: [] });

  return out;
}

/** ข้อความทั้งหมดในแบบจำลอง (ใช้ตรวจไฟล์ที่ส่งออก) */
export function layoutTexts(layout: LayoutParagraph[]): string[] {
  const texts: string[] = [];
  for (const p of layout) {
    for (const r of p.runs) if (r.kind === 'text' && r.text.trim()) texts.push(r.text.trim());
  }
  return texts;
}
