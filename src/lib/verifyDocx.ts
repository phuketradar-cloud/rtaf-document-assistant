import JSZip from 'jszip';

export interface DocxCheck {
  ok: boolean;
  problems: string[];
  /** ข้อความทั้งหมดใน document.xml ต่อกัน (ใช้ในการทดสอบ) */
  documentText: string;
  documentXml: string;
}

const REQUIRED_PARTS = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'];

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * เปิดไฟล์ .docx ที่สร้างแล้วตรวจว่า (1) เป็นไฟล์ zip ที่อ่านได้ (2) มีส่วนประกอบหลักครบ
 * (3) มีข้อความที่คาดว่าจะอยู่ในเอกสารจริง — ใช้ก่อนแจ้งผู้ใช้ว่าส่งออกสำเร็จ
 */
export async function verifyDocx(data: Blob | Uint8Array | ArrayBuffer, expectedTexts: string[]): Promise<DocxCheck> {
  const problems: string[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return { ok: false, problems: ['ไฟล์ที่สร้างไม่ใช่ไฟล์ .docx ที่อ่านได้'], documentText: '', documentXml: '' };
  }
  for (const part of REQUIRED_PARTS) {
    if (!zip.file(part)) problems.push(`ไม่พบส่วนประกอบ ${part} ในไฟล์`);
  }
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const textParts = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => decodeXml(m[1]));
  const documentText = textParts.join('');
  for (const expected of expectedTexts) {
    if (!documentText.includes(expected)) problems.push(`ไม่พบข้อความ "${expected.slice(0, 40)}" ในไฟล์ที่สร้าง`);
  }
  return { ok: problems.length === 0, problems, documentText, documentXml: xml };
}
