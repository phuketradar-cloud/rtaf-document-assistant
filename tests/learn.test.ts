import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { learnFromDocx, parseThaiDateText, DocxImportError } from '../src/lib/docxImport';
import { buildMemoDocxBuffer } from '../src/lib/docxExport';
import { BUILTIN_TEMPLATE, normalizeTemplate } from '../src/lib/templates';
import { emptyFields, PAGE_BREAK_MARKER } from '../src/lib/fields';
import { templateFromLearned } from '../src/lib/learnTemplate';
import { testFields } from './testData';

// ไฟล์นี้สร้างด้วย Microsoft Word จริง (scripts/make-sample-memo.ps1) — ข้อมูลสมมติทั้งหมด
const WORD_FIXTURE = join(__dirname, 'fixtures', 'word-memo.docx');

describe('อ่านวันที่ภาษาไทยจากเอกสาร', () => {
  it('รองรับเลขไทย เดือนเต็ม เดือนย่อ และปีสองหลัก', () => {
    expect(parseThaiDateText('๒๓ ตุลาคม ๒๕๖๙')).toEqual({ iso: '2026-10-23', style: 'full', thaiDigits: true });
    expect(parseThaiDateText('1 ม.ค. 2570')).toEqual({ iso: '2027-01-01', style: 'abbr', thaiDigits: false });
    expect(parseThaiDateText('5 ก.พ. 69')).toEqual({ iso: '2026-02-05', style: 'abbrShortYear', thaiDigits: false });
  });
  it('วันที่ที่ไม่ครบ (เว้นวันไว้) ไม่เดาวันที่', () => {
    const r = parseThaiDateText('ตุลาคม ๒๕๖๙');
    expect(r.iso).toBeUndefined();
    expect(r.style).toBe('full');
  });
});

describe('เรียนรู้จากไฟล์ที่สร้างด้วย Microsoft Word', () => {
  it('อ่านรูปแบบได้ตรงกับที่ตั้งไว้ใน Word', async () => {
    const r = await learnFromDocx(readFileSync(WORD_FIXTURE));
    const s = r.settings;
    expect(s.marginTopCm).toBeCloseTo(2, 1);
    expect(s.marginBottomCm).toBeCloseTo(2, 1);
    expect(s.marginLeftCm).toBeCloseTo(3, 1);
    expect(s.marginRightCm).toBeCloseTo(2, 1);
    expect(s.fontName).toBe('TH SarabunIT๙');
    expect(s.fontSizePt).toBe(16);
    expect(s.lineSpacing).toBe(1);
    expect(s.paragraphSpacingAfterPt).toBe(0);
    expect(s.titleText).toBe('บันทึกข้อความ');
    expect(s.titleFontSizePt).toBe(29);
    expect(s.titleBold).toBe(true);
    expect(s.titleAlign).toBe('center');
    expect(s.labelBold).toBe(true);
    expect(s.dateTabCm).toBeCloseTo(9, 1);
    expect(s.continuationIndentCm).toBeCloseTo(2.75, 1);
    expect(s.bodyFirstLineIndentCm).toBeCloseTo(2.5, 1);
    expect(s.bodyAlign).toBe('thaiDistribute');
    expect(s.signatureIndentCm).toBeCloseTo(7, 1);
    expect(s.signatureSpaceLines).toBe(3);
    expect(s.signerNameInParentheses).toBe(true);
    expect(s.dateStyle).toBe('full');
    expect(s.thaiDigits).toBe(true);
  });

  it('อ่านข้อความแต่ละช่องได้ถูกต้อง', async () => {
    const { fields: f } = await learnFromDocx(readFileSync(WORD_FIXTURE));
    expect(f.department).toBe('กองทดสอบ ฝ่ายทดสอบระบบ โทร. ๑๒๓๔');
    expect(f.docNumber).toBe('ทส ๐๖๒๑/๑๒๓');
    expect(f.date).toBe('2026-10-23');
    expect(f.subject).toBe('ขออนุมัติทดสอบระบบ');
    expect(f.to).toBe('ผู้อำนวยการกองทดสอบ');
    expect(f.reference).toBe('หนังสือ ทส ๐๖๒๑/๑ ลง ๑ ต.ค. ๖๙');
    expect(f.enclosures).toBe('๑. แบบฟอร์มทดสอบ จำนวน ๑ ชุด\n๒. รายชื่อทดสอบ จำนวน ๑ ชุด');
    expect(f.body).toBe(
      'ตามที่ อ้างถึง กองทดสอบได้รับมอบหมายให้ทดสอบระบบจัดทำเอกสาร ซึ่งเป็นข้อความสมมติสำหรับการทดสอบเท่านั้น\nในการนี้ กองทดสอบจึงขออนุมัติดำเนินการทดสอบตามสิ่งที่ส่งมาด้วย',
    );
    expect(f.closing).toBe('จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ');
    expect(f.signerName).toBe('นายทดสอบ ระบบดี');
    expect(f.signerPosition).toBe('ผู้อำนวยการกองทดสอบ');
  });
});

describe('สร้างเอกสารด้วยแม่แบบที่เรียนรู้', () => {
  it('ส่งออกไฟล์ไว้เทียบกับต้นฉบับใน Word (scripts/word-check.ps1)', async () => {
    const r = await learnFromDocx(readFileSync(WORD_FIXTURE));
    const tpl = templateFromLearned(BUILTIN_TEMPLATE, r.settings, { name: 'ทดสอบ', fileName: 'word-memo.docx', defaultFields: {} });
    const buf = await buildMemoDocxBuffer({ ...emptyFields(), ...r.fields }, tpl);
    const out = join(__dirname, '..', 'test-output');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'learned-from-word.docx'), buf);
    copyFileSync(WORD_FIXTURE, join(out, 'original-word-memo.docx'));
    expect(tpl.sourceNote).toContain('word-memo.docx');
  });
});

describe('เรียนรู้จากไฟล์ที่โปรแกรมส่งออกเอง (ไป-กลับ)', () => {
  it('ได้ค่ารูปแบบและข้อความกลับมาเท่าเดิม', async () => {
    const tpl = normalizeTemplate({
      ...BUILTIN_TEMPLATE,
      id: 'x',
      marginLeftCm: 3.5,
      fontName: 'Angsana New',
      fontSizePt: 15,
      lineSpacing: 1.5,
      dateTabCm: 8.5,
      bodyFirstLineIndentCm: 2,
      signatureIndentCm: 6.5,
      signatureSpaceLines: 4,
    })!;
    const fields = testFields();
    const r = await learnFromDocx(await buildMemoDocxBuffer(fields, tpl));
    expect(r.settings).toMatchObject({
      marginLeftCm: 3.5,
      fontName: 'Angsana New',
      fontSizePt: 15,
      lineSpacing: 1.5,
      bodyFirstLineIndentCm: 2,
      signatureIndentCm: 6.5,
      signatureSpaceLines: 4,
      bodyAlign: 'thaiDistribute',
    });
    expect(r.settings.dateTabCm).toBeCloseTo(8.5, 1);
    expect(r.fields.subject).toBe(fields.subject);
    expect(r.fields.date).toBe(fields.date);
    expect(r.fields.signerName).toBe(fields.signerName);
    expect(r.fields.signerPosition).toBe(fields.signerPosition);
    expect(r.fields.closing).toBe(fields.closing);
    expect(r.fields.body).toContain(PAGE_BREAK_MARKER);
  });
});

describe('ไฟล์ที่ไม่รองรับ', () => {
  it('แจ้งข้อผิดพลาดภาษาไทยเมื่อไม่ใช่ .docx', async () => {
    await expect(learnFromDocx(new Uint8Array([1, 2, 3]))).rejects.toThrow(DocxImportError);
    await expect(learnFromDocx(new Uint8Array([1, 2, 3]))).rejects.toThrow(/\.doc/);
  });
});
