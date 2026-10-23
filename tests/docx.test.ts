import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMemoDocxBuffer, exportFileName } from '../src/lib/docxExport';
import { buildMemoLayout, layoutTexts } from '../src/lib/layout';
import { BUILTIN_TEMPLATE, normalizeTemplate } from '../src/lib/templates';
import { verifyDocx } from '../src/lib/verifyDocx';
import { testFields } from './testData';

const OUT_DIR = join(__dirname, '..', 'test-output');

describe('ส่งออก Word (.docx)', () => {
  it('สร้างไฟล์ที่เปิดได้และมีข้อความภาษาไทยครบ', async () => {
    const fields = testFields();
    const buf = await buildMemoDocxBuffer(fields, BUILTIN_TEMPLATE);
    const check = await verifyDocx(buf, layoutTexts(buildMemoLayout(fields, BUILTIN_TEMPLATE)));
    expect(check.problems).toEqual([]);
    expect(check.ok).toBe(true);
    expect(check.documentText).toContain('ก่ ก้ ก๊ ก๋');
    expect(check.documentText).toContain('23 ตุลาคม 2569');

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'memo-default.docx'), buf);
  });

  it('ใช้ค่าฟอนต์ ขนาด ระยะขอบ การจัดแนว ตัวแบ่งหน้า ตามแม่แบบ', async () => {
    const tpl = normalizeTemplate({
      ...BUILTIN_TEMPLATE,
      id: 'custom',
      fontName: 'TH SarabunIT๙',
      fontSizePt: 15,
      marginLeftCm: 3.5,
      lineSpacing: 1.5,
      thaiDigits: true,
    })!;
    const buf = await buildMemoDocxBuffer(testFields(), tpl);
    const { documentXml: xml, documentText } = await verifyDocx(buf, []);
    expect(xml).toContain('w:cs="TH SarabunIT๙"');
    expect(xml).toContain('<w:szCs w:val="30"/>');
    expect(xml).toMatch(/<w:pgMar[^>]*w:left="1984"/);
    expect(xml).toContain('w:line="360"');
    expect(xml).toContain('<w:jc w:val="thaiDistribute"/>');
    expect(xml).toContain('<w:pageBreakBefore/>');
    expect(xml).toContain('<w:tab/>');
    expect(xml).toContain('w:bidi="th-TH"');
    // run ภาษาไทยต้องมี <w:cs/> เหมือนไฟล์ที่ Word สร้าง (มีผลต่อการตัดบรรทัด/กระจายแบบไทย)
    expect(xml).toMatch(/<w:cs\/><w:lang w:bidi="th-TH"\/><\/w:rPr><w:t[^>]*>ย่อหน้าทดสอบที่สอง/);
    expect((xml.match(/<w:cs\/>/g) ?? []).length).toBeGreaterThan(10);
    expect(documentText).toContain('๒๓ ตุลาคม ๒๕๖๙');

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'memo-custom.docx'), buf);
  });

  it('ช่องที่เว้นว่างได้ไม่ทำให้ไฟล์เสีย', async () => {
    const fields = testFields({ reference: '', enclosures: '', closing: '', body: 'ย่อหน้าเดียว' });
    const buf = await buildMemoDocxBuffer(fields, BUILTIN_TEMPLATE);
    const check = await verifyDocx(buf, layoutTexts(buildMemoLayout(fields, BUILTIN_TEMPLATE)));
    expect(check.ok).toBe(true);
    expect(check.documentText).not.toContain('อ้างถึง');
  });

  it('ตรวจพบไฟล์เสียหรือข้อความไม่ครบ', async () => {
    const bad = await verifyDocx(new Uint8Array([1, 2, 3]), []);
    expect(bad.ok).toBe(false);
    const buf = await buildMemoDocxBuffer(testFields(), BUILTIN_TEMPLATE);
    const missing = await verifyDocx(buf, ['ข้อความที่ไม่มีอยู่ในเอกสาร']);
    expect(missing.ok).toBe(false);
  });

  it('ชื่อไฟล์ไม่มีอักขระต้องห้ามของ Windows', () => {
    expect(exportFileName(testFields({ subject: 'ขอ/อนุมัติ: "ทดสอบ"?' }))).toBe('บันทึกข้อความ_ขอ อนุมัติ ทดสอบ_2026-10-23.docx');
  });
});
