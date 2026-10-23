import {
  AlignmentType,
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';
import type { Alignment, MemoFields, MemoTemplate } from '../types';
import { buildMemoLayout, type LayoutParagraph } from './layout';

const TWIPS_PER_CM = 566.929;
const A4 = { width: 11906, height: 16838 };

const cm = (v: number) => Math.round(v * TWIPS_PER_CM);

const ALIGN: Record<Alignment, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.BOTH,
  thaiDistribute: AlignmentType.THAI_DISTRIBUTE,
};

/**
 * Word ใช้ฟอนต์ "complex script" (w:cs, w:szCs) กับอักษรไทย
 * จึงต้องตั้งทั้งฟอนต์/ขนาดปกติและแบบ complex script มิฉะนั้นภาษาไทยจะไม่ใช้ค่าที่กำหนด
 */
function runStyle(t: MemoTemplate, sizePt: number, bold: boolean) {
  return {
    font: { ascii: t.fontName, hAnsi: t.fontName, cs: t.fontName, eastAsia: t.fontName },
    size: Math.round(sizePt * 2),
    sizeComplexScript: Math.round(sizePt * 2),
    bold,
    boldComplexScript: bold,
    language: { value: 'th-TH', bidirectional: 'th-TH' },
  };
}

function toParagraph(p: LayoutParagraph, t: MemoTemplate): Paragraph {
  const runs = p.runs.length
    ? p.runs.map((r) =>
        r.kind === 'tab'
          ? new TextRun({ ...runStyle(t, p.sizePt, false), children: [new Tab()] })
          : new TextRun({ ...runStyle(t, p.sizePt, !!r.bold), text: r.text }),
      )
    : [new TextRun({ ...runStyle(t, p.sizePt, false), text: '' })];
  return new Paragraph({
    children: runs,
    alignment: ALIGN[p.align],
    pageBreakBefore: p.pageBreakBefore || undefined,
    spacing: {
      before: 0,
      after: Math.round(t.paragraphSpacingAfterPt * 20),
      line: Math.round(240 * t.lineSpacing),
      lineRule: LineRuleType.AUTO,
    },
    indent: {
      left: p.leftIndentCm ? cm(p.leftIndentCm) : undefined,
      firstLine: p.firstLineIndentCm ? cm(p.firstLineIndentCm) : undefined,
    },
    tabStops: p.tabStopCm ? [{ type: TabStopType.LEFT, position: cm(p.tabStopCm) }] : undefined,
  });
}

export function buildMemoDocument(fields: MemoFields, t: MemoTemplate): Document {
  const layout = buildMemoLayout(fields, t);
  const style = runStyle(t, t.fontSizePt, false);
  return new Document({
    creator: 'RTAF Document Assistant',
    title: fields.subject.trim() || t.titleText,
    styles: {
      default: {
        document: {
          run: { font: style.font, size: style.size, sizeComplexScript: style.sizeComplexScript, language: style.language },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: A4,
            margin: {
              top: cm(t.marginTopCm),
              bottom: cm(t.marginBottomCm),
              left: cm(t.marginLeftCm),
              right: cm(t.marginRightCm),
            },
          },
        },
        children: layout.map((p) => toParagraph(p, t)),
      },
    ],
  });
}

export async function buildMemoDocxBlob(fields: MemoFields, t: MemoTemplate): Promise<Blob> {
  return Packer.toBlob(buildMemoDocument(fields, t));
}

export async function buildMemoDocxBuffer(fields: MemoFields, t: MemoTemplate): Promise<Uint8Array> {
  return Packer.toBuffer(buildMemoDocument(fields, t));
}

/** ชื่อไฟล์จากเรื่องและวันที่ — ตัดอักขระที่ Windows ไม่อนุญาต */
export function exportFileName(fields: MemoFields): string {
  const subject = fields.subject.trim().replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, 60).trim();
  const parts = ['บันทึกข้อความ', subject, fields.date.trim()].filter(Boolean);
  return parts.join('_') + '.docx';
}
