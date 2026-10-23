import { describe, expect, it } from 'vitest';
import { emptyFields } from '../src/lib/fields';
import { formatThaiDate, parseIsoDate } from '../src/lib/thaiDate';
import { BUILTIN_TEMPLATE, normalizeTemplate } from '../src/lib/templates';
import { validateMemo } from '../src/lib/validation';
import { buildMemoLayout } from '../src/lib/layout';
import { createBackup, mergeById, parseBackup } from '../src/lib/backup';
import { loadDocuments, saveDocuments, StorageError, type KeyValueStore } from '../src/lib/storage';
import type { DocumentRecord } from '../src/types';
import { testFields } from './testData';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('วันที่ภาษาไทย', () => {
  it('แปลงเป็น พ.ศ. ทุกรูปแบบ', () => {
    expect(formatThaiDate('2026-10-23', 'full', false)).toBe('23 ตุลาคม 2569');
    expect(formatThaiDate('2026-10-23', 'abbr', false)).toBe('23 ต.ค. 2569');
    expect(formatThaiDate('2026-10-23', 'abbrShortYear', false)).toBe('23 ต.ค. 69');
    expect(formatThaiDate('2026-10-23', 'full', true)).toBe('๒๓ ตุลาคม ๒๕๖๙');
  });
  it('ปฏิเสธวันที่ที่ไม่มีอยู่จริง', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('23/10/2569')).toBeNull();
    expect(parseIsoDate('2028-02-29')).not.toBeNull();
  });
});

describe('ระบบตรวจสอบ', () => {
  it('แจ้งช่องที่จำเป็นที่ยังว่างครบทุกช่อง', () => {
    const issues = validateMemo(emptyFields(), BUILTIN_TEMPLATE, { today: '2026-10-23' });
    const errors = issues.filter((i) => i.severity === 'error').map((i) => i.field);
    expect(errors.sort()).toEqual([...BUILTIN_TEMPLATE.requiredFields].sort());
  });
  it('เอกสารที่กรอกครบไม่มี error', () => {
    const issues = validateMemo(testFields(), BUILTIN_TEMPLATE, { today: '2026-10-23' });
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('แจ้งคำผิด ข้อความซ้ำ วันที่ผิดปกติ โดยไม่แก้ไขข้อมูล', () => {
    const fields = testFields({
      body: 'ขออนุญาติดำเนินการ ขอ ขอ ความกรุณา\nบรรทัดนี้ซ้ำกันแน่นอน\nบรรทัดนี้ซ้ำกันแน่นอน',
      date: '2569-10-23',
    });
    const before = JSON.stringify(fields);
    const issues = validateMemo(fields, BUILTIN_TEMPLATE, { today: '2026-10-23' });
    expect(JSON.stringify(fields)).toBe(before);
    const msgs = issues.map((i) => i.message).join('\n');
    expect(msgs).toContain('อนุญาติ');
    expect(msgs).toContain('ขอ ขอ');
    expect(msgs).toContain('ซ้ำกับบรรทัดที่ 2');
    expect(msgs).toContain('ปีของวันที่');
  });
  it('แจ้งเลขที่หนังสือซ้ำกับเอกสารอื่น และความไม่สอดคล้องของอ้างถึง', () => {
    const other = { id: 'x', fields: testFields() } as DocumentRecord;
    const issues = validateMemo(testFields({ reference: '', body: 'ตามหนังสือที่อ้างถึง' }), BUILTIN_TEMPLATE, {
      today: '2026-10-23',
      otherDocuments: [other],
    });
    const msgs = issues.map((i) => i.message).join('\n');
    expect(msgs).toContain('เลขที่หนังสือซ้ำ');
    expect(msgs).toContain('ช่องอ้างถึงยังว่าง');
  });
});

describe('แบบจำลองการจัดวาง', () => {
  it('ละช่องที่ไม่จำเป็นและว่าง และใส่ตัวแบ่งหน้า', () => {
    const layout = buildMemoLayout(testFields({ reference: '', enclosures: '' }), BUILTIN_TEMPLATE);
    const all = layout.flatMap((p) => p.runs.map((r) => (r.kind === 'text' ? r.text : '\t'))).join('|');
    expect(all).not.toContain('อ้างถึง');
    expect(all).not.toContain('สิ่งที่ส่งมาด้วย');
    const broken = layout.find((p) => p.pageBreakBefore);
    expect(broken?.runs[0]).toEqual({ kind: 'text', text: 'ย่อหน้าทดสอบบนหน้าใหม่', bold: false });
    expect(layout.some((p) => p.runs.some((r) => r.kind === 'text' && r.text === '(ทดสอบ ผู้ลงนาม)'))).toBe(true);
  });
});

describe('สำรองและนำเข้าข้อมูล', () => {
  it('ปฏิเสธไฟล์ที่ไม่ใช่ไฟล์สำรองข้อมูล พร้อมข้อความภาษาไทย', () => {
    const r1 = parseBackup('not json');
    const r2 = parseBackup('{"app":"other"}');
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toContain('ไม่ใช่ไฟล์สำรองข้อมูล');
  });
  it('สำรองแล้วนำเข้ากลับได้ข้อมูลเดิม', () => {
    const doc: DocumentRecord = {
      id: 'd1', type: 'memo', templateId: BUILTIN_TEMPLATE.id, status: 'draft', fields: testFields(),
      createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
    };
    const tpl = normalizeTemplate({ ...BUILTIN_TEMPLATE, id: 't1', name: 'แม่แบบทดสอบ' })!;
    const backup = createBackup([doc], [BUILTIN_TEMPLATE, tpl], { defaultTemplateId: 't1' });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.documents).toEqual([doc]);
    expect(parsed.backup.templates.map((t) => t.id)).toEqual(['t1']);
    expect(parsed.backup.settings.defaultTemplateId).toBe('t1');
  });
  it('รวมข้อมูลโดยเก็บรายการที่แก้ไขล่าสุด', () => {
    const a = [{ id: '1', updatedAt: '2026-01-02' }, { id: '2', updatedAt: '2026-01-01' }];
    const b = [{ id: '1', updatedAt: '2026-01-01' }, { id: '2', updatedAt: '2026-01-05' }, { id: '3', updatedAt: '2026-01-01' }];
    expect(mergeById(a, b)).toEqual([{ id: '1', updatedAt: '2026-01-02' }, { id: '2', updatedAt: '2026-01-05' }, { id: '3', updatedAt: '2026-01-01' }]);
  });
});

describe('Local Storage', () => {
  it('บันทึกและโหลดเอกสาร', () => {
    const s = memoryStore();
    const doc = { id: 'd1', fields: testFields() } as DocumentRecord;
    saveDocuments([doc], s);
    const loaded = loadDocuments(s);
    expect(loaded[0].fields.subject).toBe('ทดสอบการส่งออกเอกสารภาษาไทย');
    expect(loaded[0].status).toBe('draft');
  });
  it('ข้อมูลเสียไม่ทำให้โปรแกรมพัง', () => {
    const s = memoryStore();
    s.setItem('rtafda.documents.v1', '{broken');
    expect(loadDocuments(s)).toEqual([]);
  });
  it('แจ้งข้อผิดพลาดภาษาไทยเมื่อบันทึกไม่ได้', () => {
    const s = memoryStore();
    s.setItem = () => {
      throw new Error('blocked');
    };
    expect(() => saveDocuments([], s)).toThrow(StorageError);
    expect(() => saveDocuments([], s)).toThrow(/บันทึกข้อมูลไม่สำเร็จ/);
  });
});
