import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alignment, DateStyle, FieldKey, LabelKey, MemoFields, MemoTemplate } from '../types';
import { useAppData } from '../state/AppData';
import PreviewDocument from '../components/PreviewDocument';
import { FIELD_KEYS, FIELD_LABELS, newId } from '../lib/fields';
import { ALIGNMENT_LABELS, DATE_STYLE_LABELS } from '../lib/templates';
import { formatTimestamp } from '../lib/thaiDate';

export default function Templates() {
  const { templates, documents, settings, saveTemplate, deleteTemplate, updateSettings, notify } = useAppData();
  const [editing, setEditing] = useState<MemoTemplate | null>(null);

  if (editing) {
    return <TemplateEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />;
  }

  const duplicate = (t: MemoTemplate) => {
    const now = new Date().toISOString();
    const copy: MemoTemplate = {
      ...t,
      id: newId(),
      builtIn: false,
      name: `${t.name} (สำเนา)`,
      labels: { ...t.labels },
      requiredFields: [...t.requiredFields],
      createdAt: now,
      updatedAt: now,
    };
    if (saveTemplate(copy)) {
      notify('success', 'ทำสำเนาแม่แบบแล้ว ปรับค่าให้ตรงกับไฟล์ต้นฉบับของหน่วยแล้วกดบันทึก');
      setEditing(copy);
    }
  };

  const remove = (t: MemoTemplate) => {
    const used = documents.filter((d) => d.templateId === t.id).length;
    const msg =
      `ลบแม่แบบ “${t.name}” หรือไม่?` +
      (used ? `\nมีเอกสาร ${used} ฉบับที่ใช้แม่แบบนี้ เอกสารเหล่านั้นจะแสดงด้วยแม่แบบเริ่มต้นของโปรแกรมแทน (ข้อมูลเอกสารไม่หาย)` : '');
    if (!window.confirm(msg)) return;
    if (deleteTemplate(t.id)) notify('success', `ลบแม่แบบ “${t.name}” แล้ว`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>แม่แบบ</h1>
      </div>
      <p className="lead">
        แม่แบบเก็บเฉพาะ “รูปแบบ” ของเอกสาร (ฟอนต์ ระยะขอบ ระยะบรรทัด ตำแหน่งข้อความ ป้ายชื่อ และช่องที่จำเป็น) แยกจากข้อมูลเอกสาร
        แม่แบบเริ่มต้นของโปรแกรมแก้ไขไม่ได้ ให้กด “ทำสำเนาเพื่อแก้ไข” แล้วปรับค่าให้ตรงกับไฟล์ต้นฉบับของหน่วย และระบุแหล่งอ้างอิง
      </p>
      <div className="template-grid">
        {templates.map((t) => {
          const used = documents.filter((d) => d.templateId === t.id).length;
          const isDefault = settings.defaultTemplateId === t.id;
          return (
            <div key={t.id} className="card template-card">
              <h2>
                {t.name}
                {isDefault && <span className="tag">ค่าเริ่มต้น</span>}
              </h2>
              {t.builtIn && <div className="banner warning small">ค่าตั้งต้นจากผู้พัฒนา — ยังไม่ได้ตรวจสอบกับระเบียบ</div>}
              {t.description && <p>{t.description}</p>}
              <dl className="kv">
                <dt>แหล่งอ้างอิง</dt>
                <dd>{t.sourceNote.trim() || 'ยังไม่ได้ระบุ'}</dd>
                <dt>ฟอนต์</dt>
                <dd>
                  {t.fontName} {t.fontSizePt} pt · ระยะบรรทัด {t.lineSpacing}
                </dd>
                <dt>ระยะขอบ (ซม.)</dt>
                <dd>
                  บน {t.marginTopCm} · ล่าง {t.marginBottomCm} · ซ้าย {t.marginLeftCm} · ขวา {t.marginRightCm}
                </dd>
                <dt>ใช้กับเอกสาร</dt>
                <dd>{used} ฉบับ</dd>
                {!t.builtIn && (
                  <>
                    <dt>แก้ไขล่าสุด</dt>
                    <dd>{formatTimestamp(t.updatedAt)}</dd>
                  </>
                )}
              </dl>
              <div className="actions">
                {!t.builtIn && (
                  <button className="btn btn-small btn-primary" onClick={() => setEditing(t)}>
                    แก้ไข
                  </button>
                )}
                <button className="btn btn-small" onClick={() => duplicate(t)}>
                  {t.builtIn ? 'ทำสำเนาเพื่อแก้ไข' : 'ทำสำเนา'}
                </button>
                {!isDefault && (
                  <button
                    className="btn btn-small"
                    onClick={() => updateSettings({ ...settings, defaultTemplateId: t.id }) && notify('success', `ตั้ง “${t.name}” เป็นแม่แบบเริ่มต้นแล้ว`)}
                  >
                    ตั้งเป็นค่าเริ่มต้น
                  </button>
                )}
                {!t.builtIn && (
                  <button className="btn btn-small btn-danger" onClick={() => remove(t)}>
                    ลบ
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.1,
  min = 0,
  max = 100,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const [text, setText] = useState(String(value));
  const valid = text.trim() !== '' && Number.isFinite(Number(text)) && Number(text) >= min && Number(text) <= max;
  return (
    <label className={valid ? '' : 'has-error'}>
      {label}
      {unit ? ` (${unit})` : ''}
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
      {!valid && <span className="field-msg error">ใส่ตัวเลขระหว่าง {min} ถึง {max}</span>}
    </label>
  );
}

function AlignSelect({ label, value, onChange }: { label: string; value: Alignment; onChange: (a: Alignment) => void }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as Alignment)}>
        {(Object.keys(ALIGNMENT_LABELS) as Alignment[]).map((a) => (
          <option key={a} value={a}>
            {ALIGNMENT_LABELS[a]}
          </option>
        ))}
      </select>
    </label>
  );
}

const LABEL_KEYS: LabelKey[] = ['department', 'docNumber', 'date', 'subject', 'to', 'reference', 'enclosures'];

function TemplateEditor({ initial, onClose }: { initial: MemoTemplate; onClose: () => void }) {
  const { saveTemplate, notify, setLeaveGuard } = useAppData();
  const [t, setT] = useState<MemoTemplate>(initial);
  const dirty = JSON.stringify(t) !== JSON.stringify(initial);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    setLeaveGuard(() => dirtyRef.current);
    return () => setLeaveGuard(null);
  }, [setLeaveGuard]);

  // ตัวอย่างใช้ข้อความ ‹ชื่อช่อง› เท่านั้น ไม่ใช่ข้อมูลจริงและไม่ถูกบันทึก
  const placeholder = useMemo(() => {
    const f = {} as MemoFields;
    for (const k of FIELD_KEYS) f[k] = `‹${FIELD_LABELS[k]}›`;
    return f;
  }, []);

  const set = <K extends keyof MemoTemplate>(key: K, value: MemoTemplate[K]) => setT((x) => ({ ...x, [key]: value }));
  const setLabel = (k: LabelKey, v: string) => setT((x) => ({ ...x, labels: { ...x.labels, [k]: v } }));
  const toggleRequired = (k: FieldKey) =>
    setT((x) => ({
      ...x,
      requiredFields: x.requiredFields.includes(k) ? x.requiredFields.filter((r) => r !== k) : [...x.requiredFields, k],
    }));

  const save = () => {
    if (!t.name.trim()) {
      notify('error', 'กรุณาตั้งชื่อแม่แบบก่อนบันทึก');
      return;
    }
    if (!t.fontName.trim()) {
      notify('error', 'กรุณาระบุชื่อฟอนต์ก่อนบันทึก');
      return;
    }
    if (saveTemplate({ ...t, name: t.name.trim(), fontName: t.fontName.trim(), updatedAt: new Date().toISOString() })) {
      dirtyRef.current = false;
      notify('success', `บันทึกแม่แบบ “${t.name.trim()}” แล้ว`);
      onClose();
    }
  };

  const cancel = () => {
    if (dirty && !window.confirm('ยกเลิกการแก้ไขแม่แบบโดยไม่บันทึกหรือไม่?')) return;
    dirtyRef.current = false;
    onClose();
  };

  return (
    <div className="page editor-page">
      <div className="editor-toolbar">
        <div>
          <h1>แก้ไขแม่แบบ</h1>
          <div className="meta">{dirty ? <span className="unsaved">มีการแก้ไขที่ยังไม่ได้บันทึก</span> : 'ไม่มีการเปลี่ยนแปลง'}</div>
        </div>
        <div className="toolbar-actions">
          <button className="btn" onClick={cancel}>
            ยกเลิก
          </button>
          <button className="btn btn-primary" onClick={save}>
            บันทึกแม่แบบ
          </button>
        </div>
      </div>

      <div className="editor-split show-form">
        <div className="editor-form template-form">
          <fieldset>
            <legend>ข้อมูลแม่แบบ</legend>
            <label>
              ชื่อแม่แบบ *
              <input value={t.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label>
              คำอธิบาย
              <input value={t.description} onChange={(e) => set('description', e.target.value)} />
            </label>
            <label>
              แหล่งอ้างอิงรูปแบบ
              <textarea
                rows={2}
                value={t.sourceNote}
                onChange={(e) => set('sourceNote', e.target.value)}
                placeholder="เช่น ชื่อไฟล์ต้นฉบับของหน่วย หรือระเบียบ/หนังสือสั่งการที่ใช้อ้างอิง"
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>หน้ากระดาษ A4 — ระยะขอบ</legend>
            <div className="form-grid">
              <NumberField label="บน" unit="ซม." value={t.marginTopCm} max={10} onChange={(v) => set('marginTopCm', v)} />
              <NumberField label="ล่าง" unit="ซม." value={t.marginBottomCm} max={10} onChange={(v) => set('marginBottomCm', v)} />
              <NumberField label="ซ้าย" unit="ซม." value={t.marginLeftCm} max={10} onChange={(v) => set('marginLeftCm', v)} />
              <NumberField label="ขวา" unit="ซม." value={t.marginRightCm} max={10} onChange={(v) => set('marginRightCm', v)} />
            </div>
          </fieldset>

          <fieldset>
            <legend>ตัวอักษรและระยะบรรทัด</legend>
            <div className="form-grid">
              <label>
                ชื่อฟอนต์ (ต้องติดตั้งในเครื่อง)
                <input list="font-suggestions" value={t.fontName} onChange={(e) => set('fontName', e.target.value)} />
                <datalist id="font-suggestions">
                  <option value="TH Sarabun New" />
                  <option value="TH SarabunIT๙" />
                  <option value="TH SarabunPSK" />
                  <option value="Angsana New" />
                  <option value="Cordia New" />
                  <option value="Leelawadee UI" />
                </datalist>
              </label>
              <NumberField label="ขนาดตัวอักษร" unit="pt" step={0.5} min={6} max={72} value={t.fontSizePt} onChange={(v) => set('fontSizePt', v)} />
              <NumberField label="ระยะบรรทัด" unit="เท่า" step={0.05} min={0.5} max={4} value={t.lineSpacing} onChange={(v) => set('lineSpacing', v)} />
              <NumberField
                label="ระยะหลังย่อหน้า"
                unit="pt"
                step={1}
                max={72}
                value={t.paragraphSpacingAfterPt}
                onChange={(v) => set('paragraphSpacingAfterPt', v)}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>หัวเอกสาร</legend>
            <div className="form-grid">
              <label>
                ข้อความหัวเอกสาร
                <input value={t.titleText} onChange={(e) => set('titleText', e.target.value)} />
              </label>
              <NumberField label="ขนาดหัวเอกสาร" unit="pt" step={0.5} min={6} max={96} value={t.titleFontSizePt} onChange={(v) => set('titleFontSizePt', v)} />
              <AlignSelect label="ตำแหน่งหัวเอกสาร" value={t.titleAlign} onChange={(v) => set('titleAlign', v)} />
              <label className="check">
                <input type="checkbox" checked={t.titleBold} onChange={(e) => set('titleBold', e.target.checked)} />
                หัวเอกสารตัวหนา
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>ป้ายชื่อในเอกสาร</legend>
            <div className="form-grid">
              {LABEL_KEYS.map((k) => (
                <label key={k}>
                  ป้าย “{FIELD_LABELS[k]}”
                  <input value={t.labels[k]} onChange={(e) => setLabel(k, e.target.value)} />
                </label>
              ))}
              <label className="check">
                <input type="checkbox" checked={t.labelBold} onChange={(e) => set('labelBold', e.target.checked)} />
                ป้ายชื่อตัวหนา
              </label>
              <NumberField
                label="ตำแหน่ง “วันที่” บนบรรทัดเดียวกับ “ที่” (0 = แยกบรรทัด)"
                unit="ซม. จากขอบซ้าย"
                max={20}
                value={t.dateTabCm}
                onChange={(v) => set('dateTabCm', v)}
              />
              <NumberField
                label="ระยะเยื้องบรรทัดถัดไปของ อ้างถึง/สิ่งที่ส่งมาด้วย"
                unit="ซม."
                max={15}
                value={t.continuationIndentCm}
                onChange={(v) => set('continuationIndentCm', v)}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>เนื้อหาและผู้ลงนาม</legend>
            <div className="form-grid">
              <NumberField label="ย่อหน้าบรรทัดแรก" unit="ซม." max={10} value={t.bodyFirstLineIndentCm} onChange={(v) => set('bodyFirstLineIndentCm', v)} />
              <AlignSelect label="การจัดแนวเนื้อหา" value={t.bodyAlign} onChange={(v) => set('bodyAlign', v)} />
              <NumberField
                label="ระยะเยื้องกลุ่มลงนามจากขอบซ้าย"
                unit="ซม."
                max={15}
                value={t.signatureIndentCm}
                onChange={(v) => set('signatureIndentCm', v)}
              />
              <NumberField
                label="บรรทัดว่างสำหรับลายมือชื่อ"
                unit="บรรทัด"
                step={1}
                max={10}
                value={t.signatureSpaceLines}
                onChange={(v) => set('signatureSpaceLines', Math.round(v))}
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={t.signerNameInParentheses}
                  onChange={(e) => set('signerNameInParentheses', e.target.checked)}
                />
                ใส่วงเล็บชื่อผู้ลงนาม
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>วันที่</legend>
            <div className="form-grid">
              <label>
                รูปแบบวันที่
                <select value={t.dateStyle} onChange={(e) => set('dateStyle', e.target.value as DateStyle)}>
                  {(Object.keys(DATE_STYLE_LABELS) as DateStyle[]).map((s) => (
                    <option key={s} value={s}>
                      {DATE_STYLE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={t.thaiDigits} onChange={(e) => set('thaiDigits', e.target.checked)} />
                ใช้เลขไทยในวันที่
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>ช่องที่จำเป็นต้องกรอก</legend>
            <p className="hint">ช่องที่ไม่ได้เลือกจะเว้นว่างได้ และถ้าว่างจะไม่ปรากฏในเอกสาร</p>
            <div className="check-grid">
              {FIELD_KEYS.map((k) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={t.requiredFields.includes(k)} onChange={() => toggleRequired(k)} />
                  {FIELD_LABELS[k]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="editor-preview">
          <div className="preview-caption">ตัวอย่างรูปแบบ (ข้อความในวงเล็บ ‹ › แสดงตำแหน่งของแต่ละช่อง ไม่ใช่ข้อมูลจริง)</div>
          <PreviewDocument fields={placeholder} template={t} />
        </div>
      </div>
    </div>
  );
}
