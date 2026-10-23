import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alignment, DateStyle, FieldKey, MemoFields, MemoTemplate } from '../types';
import { useAppData } from '../state/AppData';
import { navigate } from '../router';
import PreviewDocument from '../components/PreviewDocument';
import { DocxImportError, learnFromDocx, type LearnResult } from '../lib/docxImport';
import { LEARNED_SETTING_LABELS, REUSABLE_FIELDS, templateFromLearned } from '../lib/learnTemplate';
import { emptyFields, FIELD_KEYS, FIELD_LABELS } from '../lib/fields';
import { ALIGNMENT_LABELS, DATE_STYLE_LABELS, resolveTemplate } from '../lib/templates';
import { formatThaiDate } from '../lib/thaiDate';

const MAX_FILE_MB = 20;

function formatSetting(key: string, value: unknown, unit?: string): string {
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (key === 'titleAlign' || key === 'bodyAlign') return ALIGNMENT_LABELS[value as Alignment];
  if (key === 'dateStyle') return DATE_STYLE_LABELS[value as DateStyle];
  return `${value}${unit ? ` ${unit}` : ''}`;
}

export default function Learn() {
  const { templates, settings, saveTemplate, notify, newDocPrefillRef, setLeaveGuard } = useAppData();
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<LearnResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [baseId, setBaseId] = useState(settings.defaultTemplateId);
  const [name, setName] = useState('');
  const [keep, setKeep] = useState<Set<FieldKey>>(new Set());
  const [inputKey, setInputKey] = useState(0);
  const base = resolveTemplate(templates, baseId).template;

  const pendingRef = useRef(false);
  pendingRef.current = !!result;
  /** บันทึกแล้วกำลังไปหน้าเอกสารใหม่ — ไม่ต้องถามยืนยันการออกจากหน้า */
  const leavingAfterSave = useRef(false);
  useEffect(() => {
    setLeaveGuard(() => !leavingAfterSave.current && pendingRef.current);
    return () => setLeaveGuard(null);
  }, [setLeaveGuard]);

  const reset = () => {
    setResult(null);
    setFileName('');
    setInputKey((k) => k + 1);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.doc$/i.test(file.name)) {
      notify('error', 'ไฟล์ .doc แบบเก่ายังไม่รองรับ — เปิดไฟล์ใน Word แล้วเลือก “บันทึกเป็น” ชนิด .docx แล้วอัปโหลดใหม่');
      setInputKey((k) => k + 1);
      return;
    }
    if (!/\.docx$/i.test(file.name)) {
      notify('error', 'รองรับเฉพาะไฟล์ Word นามสกุล .docx (ไฟล์ PDF หรือรูปภาพยังไม่รองรับ)');
      setInputKey((k) => k + 1);
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      notify('error', `ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB — ลองลบรูปภาพขนาดใหญ่ออกจากไฟล์ก่อน`);
      setInputKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      const r = await learnFromDocx(await file.arrayBuffer());
      setResult(r);
      setFileName(file.name);
      setName(`แม่แบบจาก ${file.name.replace(/\.docx$/i, '')}`);
      setKeep(new Set(REUSABLE_FIELDS.filter((k) => r.fields[k]?.trim())));
    } catch (e) {
      notify('error', e instanceof DocxImportError ? e.message : 'อ่านไฟล์ไม่สำเร็จ — ตรวจว่าไฟล์เปิดใน Word ได้ตามปกติ แล้วลองใหม่');
      setInputKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const keptFields = useMemo(() => {
    const f: Partial<MemoFields> = {};
    if (result) for (const k of keep) if (result.fields[k]) f[k] = result.fields[k];
    return f;
  }, [keep, result]);

  const draft: MemoTemplate | null = useMemo(
    () => (result ? templateFromLearned(base, result.settings, { name: name.trim() || 'แม่แบบไม่มีชื่อ', fileName, defaultFields: keptFields }) : null),
    [result, base, name, fileName, keptFields],
  );
  const exampleFields = useMemo(() => ({ ...emptyFields(), ...result?.fields }), [result]);

  const save = (thenCreate: boolean) => {
    if (!draft || !result) return;
    if (!name.trim()) {
      notify('error', 'กรุณาตั้งชื่อแม่แบบก่อนบันทึก');
      return;
    }
    if (!saveTemplate(draft)) return;
    if (thenCreate) {
      leavingAfterSave.current = true;
      // คัดลอกข้อความทุกช่องจากตัวอย่าง ยกเว้นวันที่ (ผู้ใช้ต้องเลือกวันที่ของเอกสารใหม่เอง)
      const { date: _date, ...rest } = result.fields;
      newDocPrefillRef.current = { templateId: draft.id, fields: rest };
      notify('success', `บันทึกแม่แบบ “${draft.name}” แล้ว — กำลังเปิดเอกสารใหม่ตามตัวอย่าง`);
      navigate('/new');
    } else {
      notify('success', `บันทึกแม่แบบ “${draft.name}” แล้ว — ดูหรือแก้ไขได้ในเมนู “แม่แบบ”`);
      reset();
    }
  };

  const toggleKeep = (k: FieldKey) =>
    setKeep((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className="page editor-page">
      <div className="page-head">
        <h1>เรียนรู้จากตัวอย่าง</h1>
      </div>
      <p className="lead">
        อัปโหลดบันทึกข้อความฉบับจริง (.docx) โปรแกรมจะอ่านรูปแบบ (ระยะขอบ ฟอนต์ ระยะบรรทัด ตำแหน่งข้อความ) และข้อความในแต่ละช่อง
        แล้วสร้างเป็นแม่แบบใหม่ให้ตรวจก่อนบันทึก — ไฟล์ถูกอ่านในเบราว์เซอร์นี้เท่านั้น ไม่ถูกส่งหรือเก็บไว้ที่ใด
      </p>

      <section className="card">
        <h2>1. เลือกไฟล์ตัวอย่าง</h2>
        <input
          key={inputKey}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => onFile(e.target.files?.[0])}
          disabled={busy}
        />
        <p className="hint">
          รองรับเฉพาะ .docx — ถ้าเป็น .doc ให้เปิดใน Word แล้วบันทึกเป็น .docx ก่อน · รูปภาพ (เช่น ตราครุฑ) และตารางจะไม่ถูกนำมาใช้
        </p>
        {busy && <p>กำลังอ่านไฟล์...</p>}
      </section>

      {result && draft && (
        <>
          {result.notes.length > 0 && (
            <div className="banner warning">
              <strong>ข้อสังเกตจากการอ่านไฟล์ “{fileName}”</strong>
              <ul>
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="editor-split show-form">
            <div className="editor-form">
              <section className="card">
                <h2>2. รูปแบบที่อ่านได้</h2>
                <p className="hint">ค่าที่อ่านไม่พบจะใช้ค่าจากแม่แบบตั้งต้นที่เลือกด้านล่าง</p>
                <label className="inline-label">
                  แม่แบบตั้งต้น
                  <select value={base.id} onChange={(e) => setBaseId(e.target.value)}>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <table className="doc-table learn-table">
                  <thead>
                    <tr>
                      <th>รายการ</th>
                      <th>ค่าที่จะใช้</th>
                      <th>ที่มา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEARNED_SETTING_LABELS.map(({ key, label, unit }) => {
                      const found = result.settings[key] !== undefined;
                      return (
                        <tr key={key}>
                          <td data-label="รายการ">{label}</td>
                          <td data-label="ค่าที่จะใช้">{formatSetting(key, draft[key], unit)}</td>
                          <td data-label="ที่มา">
                            {found ? <span className="status exported">จากไฟล์</span> : <span className="status draft">ค่าเดิม</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="card">
                <h2>3. ข้อความที่อ่านได้</h2>
                <p className="hint">
                  ติ๊กช่องที่ต้องการให้ <strong>เติมอัตโนมัติทุกครั้ง</strong> ที่สร้างเอกสารใหม่ด้วยแม่แบบนี้ (เช่น ส่วนราชการ ผู้ลงนาม)
                  — ช่องที่ไม่ติ๊กจะไม่ถูกเก็บในแม่แบบ
                </p>
                <table className="doc-table learn-table">
                  <thead>
                    <tr>
                      <th>ช่อง</th>
                      <th>ข้อความในไฟล์</th>
                      <th>เติมทุกครั้ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELD_KEYS.map((k) => {
                      const v = result.fields[k];
                      const shown = k === 'date' && v ? formatThaiDate(v, draft.dateStyle, draft.thaiDigits) : v;
                      return (
                        <tr key={k}>
                          <td data-label="ช่อง">{FIELD_LABELS[k]}</td>
                          <td data-label="ข้อความในไฟล์" className="pre">
                            {shown ? (shown.length > 300 ? `${shown.slice(0, 300)}…` : shown) : <span className="meta">ไม่พบ</span>}
                          </td>
                          <td data-label="เติมทุกครั้ง">
                            {k === 'date' ? (
                              <span className="meta">ไม่ใช้</span>
                            ) : (
                              <input type="checkbox" checked={keep.has(k)} disabled={!v} onChange={() => toggleKeep(k)} aria-label={`เติม ${FIELD_LABELS[k]} ทุกครั้ง`} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="card">
                <h2>4. บันทึก</h2>
                <label>
                  ชื่อแม่แบบ
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <div className="actions" style={{ marginTop: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={() => save(true)}>
                    บันทึกแม่แบบ และสร้างเอกสารตามตัวอย่าง
                  </button>
                  <button className="btn" onClick={() => save(false)}>
                    บันทึกเป็นแม่แบบอย่างเดียว
                  </button>
                  <button className="btn" onClick={reset}>
                    ยกเลิก
                  </button>
                </div>
                <p className="hint" style={{ marginTop: '0.5rem' }}>
                  “สร้างเอกสารตามตัวอย่าง” จะคัดลอกข้อความทุกช่องจากไฟล์ (ยกเว้นวันที่) ไปเป็นเอกสารใหม่ที่ยังไม่บันทึก ให้แก้ไขต่อ
                </p>
              </section>
            </div>
            <div className="editor-preview">
              <div className="preview-caption">ตัวอย่างเมื่อใช้แม่แบบใหม่กับข้อความจากไฟล์ — เปรียบเทียบกับไฟล์ต้นฉบับใน Word</div>
              <PreviewDocument fields={exampleFields} template={draft} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
