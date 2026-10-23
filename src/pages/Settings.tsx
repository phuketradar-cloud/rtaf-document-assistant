import { useState } from 'react';
import { useAppData } from '../state/AppData';
import { createBackup, mergeById, parseBackup, type BackupFile } from '../lib/backup';
import { downloadText } from '../lib/download';
import { storageUsageBytes } from '../lib/storage';
import { formatTimestamp, todayIso } from '../lib/thaiDate';
import type { ThemeId } from '../types';

const THEMES: { id: ThemeId; name: string; description: string; swatch: string[] }[] = [
  { id: 'default', name: 'มาตรฐาน', description: 'พื้นสว่าง สีน้ำเงินกรมท่า เหมาะกับงานสำนักงานทั่วไป', swatch: ['#f3f5f8', '#1b3557', '#0f6b4f'] },
  { id: 'hud', name: 'Futuristic HUD', description: 'พื้นมืด เส้นสีฟ้าแบบจอแสดงผลทางยุทธวิธี', swatch: ['#080e18', '#111f2d', '#27e5e0', '#8ddfff'] },
];

export default function Settings() {
  const { documents, templates, settings, updateSettings, replaceAll, clearAllData, notify } = useAppData();
  const [pending, setPending] = useState<{ backup: BackupFile; fileName: string; skipped: number } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [fileKey, setFileKey] = useState(0);

  let usage = 0;
  try {
    usage = storageUsageBytes();
  } catch {
    usage = 0;
  }
  const userTemplates = templates.filter((t) => !t.builtIn);

  const exportBackup = () => {
    const backup = createBackup(documents, templates, settings);
    downloadText(JSON.stringify(backup, null, 2), `rtaf-document-assistant-backup-${todayIso()}.json`);
    notify('success', `สร้างไฟล์สำรองข้อมูลแล้ว (เอกสาร ${documents.length} ฉบับ, แม่แบบ ${userTemplates.length} รายการ) — เก็บไฟล์ไว้ในที่ปลอดภัย`);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      notify('error', result.error);
      setFileKey((k) => k + 1);
      return;
    }
    setPending({ backup: result.backup, fileName: file.name, skipped: result.skipped });
  };

  const cancelImport = () => {
    setPending(null);
    setFileKey((k) => k + 1);
  };

  const doImport = () => {
    if (!pending) return;
    const b = pending.backup;
    let ok: boolean;
    if (mode === 'replace') {
      if (!window.confirm(`แทนที่ข้อมูลทั้งหมดในเครื่องนี้ด้วยข้อมูลจากไฟล์หรือไม่?\nเอกสารปัจจุบัน ${documents.length} ฉบับจะถูกแทนที่ — ควรสำรองข้อมูลปัจจุบันก่อน`)) return;
      ok = replaceAll(b.documents, b.templates, b.settings);
    } else {
      ok = replaceAll(mergeById(documents, b.documents), mergeById(userTemplates, b.templates), settings);
    }
    if (ok) {
      notify(
        'success',
        `นำเข้าข้อมูลแล้ว (เอกสาร ${b.documents.length} ฉบับ, แม่แบบ ${b.templates.length} รายการ${pending.skipped ? `, ข้ามรายการที่อ่านไม่ได้ ${pending.skipped} รายการ` : ''})`,
      );
      cancelImport();
    }
  };

  const clearEverything = () => {
    if (!window.confirm('ลบเอกสาร แม่แบบ และการตั้งค่าทั้งหมดในเบราว์เซอร์นี้หรือไม่?\nควรสำรองข้อมูลก่อน')) return;
    if (!window.confirm('ยืนยันอีกครั้ง: การลบนี้ไม่สามารถกู้คืนได้หากไม่มีไฟล์สำรองข้อมูล')) return;
    if (clearAllData()) notify('success', 'ลบข้อมูลทั้งหมดแล้ว');
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>ตั้งค่า</h1>
      </div>

      <section className="card">
        <h2>ธีมหน้าจอ</h2>
        <p className="hint">มีผลเฉพาะหน้าจอโปรแกรมในเบราว์เซอร์นี้ ไม่มีผลกับไฟล์ Word ที่ส่งออก</p>
        <div className="theme-options" role="radiogroup" aria-label="ธีมหน้าจอ" style={{ marginTop: '0.75rem' }}>
          {THEMES.map((t) => (
            <label key={t.id} className={`theme-option${settings.theme === t.id ? ' selected' : ''}`}>
              <input
                type="radio"
                name="theme"
                checked={settings.theme === t.id}
                onChange={() => updateSettings({ ...settings, theme: t.id }) && notify('success', `เปลี่ยนเป็นธีม “${t.name}” แล้ว`)}
              />
              <span className="theme-swatch" aria-hidden="true">
                {t.swatch.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </span>
              <span>
                <strong>{t.name}</strong>
                <span className="hint">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>แม่แบบเริ่มต้นสำหรับเอกสารใหม่</h2>
        <select
          value={settings.defaultTemplateId}
          onChange={(e) => updateSettings({ ...settings, defaultTemplateId: e.target.value }) && notify('success', 'บันทึกการตั้งค่าแล้ว')}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>สำรองข้อมูล</h2>
        <p>
          ดาวน์โหลดเอกสารและแม่แบบทั้งหมดเป็นไฟล์ .json เพื่อเก็บไว้หรือย้ายไปเครื่องอื่น ข้อมูลในเบราว์เซอร์อาจหายได้หากล้างประวัติการใช้งาน
          จึงควรสำรองข้อมูลสม่ำเสมอ
        </p>
        <button className="btn btn-primary" onClick={exportBackup}>
          ดาวน์โหลดไฟล์สำรองข้อมูล
        </button>
      </section>

      <section className="card">
        <h2>นำเข้าข้อมูล</h2>
        <p>เลือกไฟล์สำรองข้อมูล (.json) ที่ได้จากปุ่ม “ดาวน์โหลดไฟล์สำรองข้อมูล”</p>
        <input key={fileKey} type="file" accept=".json,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
        {pending && (
          <div className="import-box">
            <p>
              ไฟล์ <strong>{pending.fileName}</strong>
              {pending.backup.exportedAt ? ` (สำรองเมื่อ ${formatTimestamp(pending.backup.exportedAt)})` : ''}: เอกสาร{' '}
              {pending.backup.documents.length} ฉบับ, แม่แบบ {pending.backup.templates.length} รายการ
              {pending.skipped ? ` — มี ${pending.skipped} รายการที่อ่านไม่ได้และจะถูกข้าม` : ''}
            </p>
            <label className="check">
              <input type="radio" name="mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
              รวมกับข้อมูลเดิม (รายการเดียวกันจะเก็บฉบับที่แก้ไขล่าสุด)
            </label>
            <label className="check">
              <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              แทนที่ข้อมูลทั้งหมดในเครื่องนี้
            </label>
            <div className="actions">
              <button className="btn btn-primary" onClick={doImport}>
                นำเข้าข้อมูล
              </button>
              <button className="btn" onClick={cancelImport}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>ความเป็นส่วนตัวและการจัดเก็บ</h2>
        <ul>
          <li>ข้อมูลทั้งหมดเก็บใน Local Storage ของเบราว์เซอร์เครื่องนี้ ไม่ส่งไปยังเซิร์ฟเวอร์หรือบริการภายนอก</li>
          <li>Local Storage ไม่ได้เข้ารหัส — ห้ามใช้โปรแกรมนี้กับข้อมูลลับ และห้ามพิมพ์รหัสผ่านลงในเอกสาร</li>
          <li>ข้อมูลผูกกับเบราว์เซอร์และที่อยู่ {window.location.origin} — ถ้าเปลี่ยนเบราว์เซอร์หรือเปิดจากที่อยู่อื่น จะไม่เห็นข้อมูลเดิม ให้ใช้การสำรอง/นำเข้าข้อมูล</li>
          <li>พื้นที่ที่ใช้ประมาณ {(usage / 1024).toFixed(1)} KB (เบราว์เซอร์ส่วนใหญ่จำกัดราว 5 MB)</li>
        </ul>
      </section>

      <section className="card danger-zone">
        <h2>ลบข้อมูลทั้งหมด</h2>
        <p>ลบเอกสาร แม่แบบที่สร้างเอง และการตั้งค่าทั้งหมดในเบราว์เซอร์นี้</p>
        <button className="btn btn-danger" onClick={clearEverything}>
          ลบข้อมูลทั้งหมด
        </button>
      </section>
    </div>
  );
}
