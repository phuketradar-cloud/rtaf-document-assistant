import { useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentRecord, FieldKey, MemoFields, MemoTemplate } from '../types';
import { useAppData } from '../state/AppData';
import { navigate } from '../router';
import MemoForm from '../components/MemoForm';
import PreviewDocument from '../components/PreviewDocument';
import ValidationPanel from '../components/ValidationPanel';
import { emptyFields, FIELD_KEYS, newId } from '../lib/fields';
import { resolveTemplate } from '../lib/templates';
import { countBySeverity, validateMemo } from '../lib/validation';
import { buildMemoDocxBlob, exportFileName } from '../lib/docxExport';
import { buildMemoLayout, layoutTexts } from '../lib/layout';
import { verifyDocx } from '../lib/verifyDocx';
import { downloadBlob } from '../lib/download';
import { formatTimestamp } from '../lib/thaiDate';

export default function Editor({ docId }: { docId?: string }) {
  const { documents } = useAppData();
  if (docId) {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) {
      return (
        <div className="page">
          <h1>ไม่พบเอกสาร</h1>
          <p>เอกสารนี้อาจถูกลบไปแล้ว หรือข้อมูลถูกล้างจากเบราว์เซอร์</p>
          <p>
            <a href="#/documents">ไปที่รายการเอกสารทั้งหมด</a>
          </p>
        </div>
      );
    }
    return <EditorInner existing={doc} />;
  }
  return <EditorInner />;
}

function sameFields(a: MemoFields, b: MemoFields) {
  return FIELD_KEYS.every((k) => a[k] === b[k]);
}

function EditorInner({ existing }: { existing?: DocumentRecord }) {
  const { documents, templates, settings, saveDocument, notify, setLeaveGuard, newDocPrefillRef } = useAppData();
  // เอกสารใหม่: เติมข้อความเริ่มต้นของแม่แบบ และข้อความที่เลือกจากหน้า “เรียนรู้จากตัวอย่าง” (ถ้ามี)
  const [start] = useState(() => {
    if (existing) return { templateId: existing.templateId, fields: { ...existing.fields }, fromExample: false };
    const pre = newDocPrefillRef.current;
    const tid = pre?.templateId ?? settings.defaultTemplateId;
    const tpl = resolveTemplate(templates, tid).template;
    return { templateId: tid, fields: { ...emptyFields(), ...tpl.defaultFields, ...pre?.fields }, fromExample: !!pre };
  });
  useEffect(() => {
    newDocPrefillRef.current = null;
  }, [newDocPrefillRef]);
  const [fields, setFields] = useState<MemoFields>(start.fields);
  const [templateId, setTemplateId] = useState(start.templateId);
  const [view, setView] = useState<'form' | 'preview'>('form');
  const [exporting, setExporting] = useState(false);
  const { template, missing } = resolveTemplate(templates, templateId);

  const templateDefaults = (t: MemoTemplate): MemoFields => ({ ...emptyFields(), ...t.defaultFields });
  // เอกสารใหม่ถือว่า “ยังไม่แก้ไข” เมื่อมีเพียงข้อความเริ่มต้นของแม่แบบ
  const baseFields = existing?.fields ?? templateDefaults(template);
  const baseTemplateId = existing?.templateId ?? start.templateId;

  const changeTemplate = (id: string) => {
    // เอกสารใหม่ที่ยังไม่ได้พิมพ์อะไรเพิ่ม: เปลี่ยนข้อความเริ่มต้นตามแม่แบบใหม่
    if (!existing && sameFields(fields, templateDefaults(template))) {
      setFields(templateDefaults(resolveTemplate(templates, id).template));
    }
    setTemplateId(id);
  };
  const dirty = !sameFields(fields, baseFields) || templateId !== baseTemplateId;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  /** ตั้งเป็น true เมื่อบันทึกเอกสารใหม่แล้วกำลังย้ายไปหน้าแก้ไข — ไม่ต้องถามยืนยันการออกจากหน้า */
  const leavingAfterSave = useRef(false);

  useEffect(() => {
    setLeaveGuard(() => !leavingAfterSave.current && dirtyRef.current);
    return () => setLeaveGuard(null);
  }, [setLeaveGuard]);

  const others = useMemo(() => documents.filter((d) => d.id !== existing?.id), [documents, existing?.id]);
  const issues = useMemo(() => validateMemo(fields, template, { otherDocuments: others }), [fields, template, others]);

  const setField = (key: FieldKey, value: string) => setFields((f) => ({ ...f, [key]: value }));

  const focusField = (key: FieldKey) => {
    setView('form');
    requestAnimationFrame(() => {
      const el = document.getElementById(`field-${key}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
    });
  };

  const save = () => {
    const now = new Date().toISOString();
    const record: DocumentRecord = existing
      ? { ...existing, fields: { ...fields }, templateId, status: 'draft', updatedAt: now }
      : { id: newId(), type: 'memo', templateId, status: 'draft', fields: { ...fields }, createdAt: now, updatedAt: now };
    if (!saveDocument(record)) return;
    notify('success', 'บันทึกฉบับร่างแล้ว');
    if (!existing) {
      leavingAfterSave.current = true;
      navigate(`/edit/${encodeURIComponent(record.id)}`);
    }
  };

  const exportWord = async () => {
    const c = countBySeverity(issues);
    if (
      c.error > 0 &&
      !window.confirm(`เอกสารยังมีข้อผิดพลาด ${c.error} รายการ (ดูรายการในส่วน “ผลการตรวจเบื้องต้น”)\nต้องการส่งออกไฟล์ Word ต่อหรือไม่?`)
    ) {
      return;
    }
    setExporting(true);
    try {
      const blob = await buildMemoDocxBlob(fields, template);
      const check = await verifyDocx(blob, layoutTexts(buildMemoLayout(fields, template)));
      if (!check.ok) {
        notify(
          'error',
          `ส่งออกไม่สำเร็จ: ไฟล์ที่สร้างไม่ผ่านการตรวจ (${check.problems.join('; ')}) — ลองส่งออกอีกครั้ง ถ้ายังไม่ได้ ให้สำรองข้อมูลแล้วแจ้งผู้ดูแลระบบ`,
        );
        return;
      }
      const name = exportFileName(fields);
      downloadBlob(blob, name);
      if (existing && !dirty) {
        saveDocument({ ...existing, status: 'exported', lastExportedAt: new Date().toISOString() });
      }
      notify(
        'success',
        `สร้างไฟล์ “${name}” (${Math.max(1, Math.round(blob.size / 1024))} KB) และตรวจแล้วว่าไฟล์เปิดได้และมีข้อความครบ — ส่งให้เบราว์เซอร์ดาวน์โหลดแล้ว โปรดเปิดตรวจรูปแบบใน Microsoft Word ก่อนใช้งาน`,
      );
      if (dirty) notify('info', 'ไฟล์ที่ส่งออกใช้ข้อมูลบนหน้าจอซึ่งยังไม่ได้บันทึก — กด “บันทึกฉบับร่าง” ถ้าต้องการเก็บไว้');
    } catch (e) {
      notify('error', `เกิดข้อผิดพลาดระหว่างสร้างไฟล์ Word: ${e instanceof Error ? e.message : String(e)} — ลองอีกครั้ง หรือรีเฟรชหน้าเว็บ`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page editor-page">
      <div className="editor-toolbar">
        <div>
          <h1>{existing ? 'แก้ไขบันทึกข้อความ' : 'สร้างบันทึกข้อความใหม่'}</h1>
          <div className="meta">
            {existing ? (
              <>
                สถานะ: {existing.status === 'exported' && !dirty ? 'ส่งออกแล้ว' : 'ฉบับร่าง'} · บันทึกล่าสุด {formatTimestamp(existing.updatedAt)}
                {existing.copiedFromId ? ' · เอกสารนี้เป็นสำเนา โปรดตรวจเลขที่และวันที่' : ''}
              </>
            ) : (
              'ยังไม่ได้บันทึก'
            )}
            {dirty && <span className="unsaved"> · มีการแก้ไขที่ยังไม่ได้บันทึก</span>}
          </div>
        </div>
        <div className="toolbar-actions">
          <label className="inline-label">
            แม่แบบ
            <select value={template.id} onChange={(e) => changeTemplate(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={save}>
            บันทึกฉบับร่าง
          </button>
          <button className="btn btn-accent" onClick={exportWord} disabled={exporting}>
            {exporting ? 'กำลังสร้างไฟล์...' : 'ส่งออก Word (.docx)'}
          </button>
        </div>
      </div>

      {start.fromExample && !existing && (
        <div className="banner warning">
          เติมข้อความจากไฟล์ตัวอย่างแล้ว — โปรดตรวจและแก้ไขทุกช่อง โดยเฉพาะเลขที่ วันที่ เรื่อง และชื่อบุคคล ก่อนบันทึก
        </div>
      )}
      {missing && (
        <div className="banner warning">
          ไม่พบแม่แบบที่เอกสารนี้เคยใช้ (อาจถูกลบไปแล้ว) — ตอนนี้แสดงด้วยแม่แบบเริ่มต้นของโปรแกรม เลือกแม่แบบใหม่แล้วกดบันทึก
        </div>
      )}
      {template.builtIn && (
        <div className="banner info">
          กำลังใช้แม่แบบเริ่มต้นของโปรแกรม ซึ่งยังไม่ได้ตรวจสอบกับระเบียบ — ควรสร้างแม่แบบที่ตรงกับต้นฉบับของหน่วยในเมนู “แม่แบบ”
        </div>
      )}

      <div className="view-switch" role="tablist">
        <button role="tab" aria-selected={view === 'form'} className={view === 'form' ? 'active' : ''} onClick={() => setView('form')}>
          แบบฟอร์ม
        </button>
        <button role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>
          ตัวอย่างเอกสาร
        </button>
      </div>

      <div className={`editor-split show-${view}`}>
        <div className="editor-form">
          <MemoForm fields={fields} template={template} issues={issues} onChange={setField} />
          <ValidationPanel issues={issues} onSelectField={focusField} />
        </div>
        <div className="editor-preview">
          <div className="preview-caption">
            ตัวอย่างโดยประมาณ — ตำแหน่งตัดบรรทัด/ตัดหน้าในไฟล์ Word อาจต่างเล็กน้อย และขึ้นกับฟอนต์ที่ติดตั้งในเครื่อง
          </div>
          <PreviewDocument fields={fields} template={template} />
        </div>
      </div>
    </div>
  );
}
