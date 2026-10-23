import { useRef } from 'react';
import type { FieldKey, MemoFields, MemoTemplate, ValidationIssue } from '../types';
import { FIELD_LABELS, PAGE_BREAK_MARKER } from '../lib/fields';
import { formatThaiDate, todayIso } from '../lib/thaiDate';

interface Props {
  fields: MemoFields;
  template: MemoTemplate;
  issues: ValidationIssue[];
  onChange: (key: FieldKey, value: string) => void;
}

const HINTS: Partial<Record<FieldKey, string>> = {
  reference: 'เว้นว่างได้ — ถ้ามีหลายรายการ ให้ขึ้นบรรทัดใหม่ทีละรายการ',
  enclosures: 'เว้นว่างได้ — ถ้ามีหลายรายการ ให้ขึ้นบรรทัดใหม่ทีละรายการ',
  body: `กด Enter เพื่อขึ้นย่อหน้าใหม่ บรรทัดว่างจะเป็นบรรทัดว่างในเอกสาร และบรรทัด ${PAGE_BREAK_MARKER} จะขึ้นหน้าใหม่`,
  closing: 'เว้นว่างได้ เช่น ข้อความ “จึงเรียนมาเพื่อโปรดพิจารณา”',
  signerName: 'พิมพ์ชื่อตามที่ต้องการให้ปรากฏ (ยศ ชื่อ สกุล)',
  signerPosition: 'ถ้ามีหลายบรรทัด ให้ขึ้นบรรทัดใหม่',
};

const MULTILINE: Partial<Record<FieldKey, number>> = {
  reference: 2,
  enclosures: 2,
  body: 10,
  closing: 2,
  signerPosition: 2,
};

export default function MemoForm({ fields, template, issues, onChange }: Props) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertPageBreak = () => {
    const el = bodyRef.current;
    const v = fields.body;
    const pos = el ? el.selectionStart : v.length;
    const before = v.slice(0, pos);
    const after = v.slice(pos);
    const insert = `${before && !before.endsWith('\n') ? '\n' : ''}${PAGE_BREAK_MARKER}\n`;
    onChange('body', before + insert + after);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = pos + insert.length;
    });
  };

  const field = (key: FieldKey) => {
    const required = template.requiredFields.includes(key);
    const fieldIssues = issues.filter((i) => i.field === key && i.severity !== 'info');
    const hasError = fieldIssues.some((i) => i.severity === 'error');
    const hasWarning = fieldIssues.some((i) => i.severity === 'warning');
    const cls = hasError ? 'has-error' : hasWarning ? 'has-warning' : '';
    const id = `field-${key}`;
    const rows = MULTILINE[key];
    return (
      <div className={`form-field ${cls}`} key={key}>
        <label htmlFor={id}>
          {FIELD_LABELS[key]}
          {required ? <span className="req" title="จำเป็นต้องกรอกตามแม่แบบนี้"> *</span> : <span className="opt"> (เว้นว่างได้)</span>}
        </label>
        {key === 'date' ? (
          <div className="date-row">
            <input id={id} type="date" value={fields.date} onChange={(e) => onChange('date', e.target.value)} />
            <button type="button" className="btn btn-small" onClick={() => onChange('date', todayIso())}>
              ใช้วันนี้
            </button>
            <span className="date-display">
              {fields.date ? `จะแสดงในเอกสารเป็น: ${formatThaiDate(fields.date, template.dateStyle, template.thaiDigits)}` : ''}
            </span>
          </div>
        ) : rows ? (
          <textarea
            id={id}
            ref={key === 'body' ? bodyRef : undefined}
            rows={rows}
            value={fields[key]}
            onChange={(e) => onChange(key, e.target.value)}
          />
        ) : (
          <input id={id} type="text" value={fields[key]} onChange={(e) => onChange(key, e.target.value)} />
        )}
        {key === 'body' && (
          <button type="button" className="btn btn-small" onClick={insertPageBreak}>
            แทรกตัวแบ่งหน้า ณ ตำแหน่งเคอร์เซอร์
          </button>
        )}
        {HINTS[key] && <div className="hint">{HINTS[key]}</div>}
        {fieldIssues.map((i) => (
          <div key={i.id} className={`field-msg ${i.severity}`}>
            {i.message}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="memo-form">
      <fieldset>
        <legend>ส่วนหัวเอกสาร</legend>
        {field('department')}
        <div className="form-row">
          {field('docNumber')}
          {field('date')}
        </div>
        {field('subject')}
        {field('to')}
        {field('reference')}
        {field('enclosures')}
      </fieldset>
      <fieldset>
        <legend>เนื้อหา</legend>
        {field('body')}
        {field('closing')}
      </fieldset>
      <fieldset>
        <legend>ผู้ลงนาม</legend>
        {field('signerName')}
        {field('signerPosition')}
      </fieldset>
    </div>
  );
}
