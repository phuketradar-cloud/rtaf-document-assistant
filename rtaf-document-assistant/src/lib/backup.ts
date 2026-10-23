import type { AppSettings, DocumentRecord, MemoTemplate } from '../types';
import { normalizeDocument } from './storage';
import { BUILTIN_TEMPLATE_ID, normalizeTemplate } from './templates';

export const BACKUP_APP_ID = 'rtaf-document-assistant';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  documents: DocumentRecord[];
  templates: MemoTemplate[];
  settings: AppSettings;
}

export function createBackup(documents: DocumentRecord[], templates: MemoTemplate[], settings: AppSettings): BackupFile {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    documents,
    templates: templates.filter((t) => !t.builtIn),
    settings,
  };
}

export type ParseResult =
  | { ok: true; backup: BackupFile; skipped: number }
  | { ok: false; error: string };

/** ตรวจไฟล์สำรองข้อมูลก่อนนำเข้า — ไม่เชื่อข้อมูลในไฟล์โดยไม่ตรวจ */
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์ JSON — โปรดเลือกไฟล์สำรองข้อมูลที่ได้จากเมนู “ตั้งค่า > สำรองข้อมูล”' };
  }
  if (!data || typeof data !== 'object') return { ok: false, error: 'รูปแบบไฟล์สำรองข้อมูลไม่ถูกต้อง' };
  const d = data as Record<string, unknown>;
  if (d.app !== BACKUP_APP_ID) {
    return { ok: false, error: 'ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของ RTAF Document Assistant' };
  }
  if (typeof d.version !== 'number' || d.version > BACKUP_VERSION) {
    return { ok: false, error: 'ไฟล์สำรองข้อมูลมาจากโปรแกรมรุ่นใหม่กว่า — โปรดอัปเดตโปรแกรมก่อนนำเข้า' };
  }
  const rawDocs = Array.isArray(d.documents) ? d.documents : [];
  const rawTemplates = Array.isArray(d.templates) ? d.templates : [];
  const documents = rawDocs.map(normalizeDocument).filter((x): x is DocumentRecord => x !== null);
  const templates = rawTemplates
    .map(normalizeTemplate)
    .filter((x): x is MemoTemplate => x !== null && x.id !== BUILTIN_TEMPLATE_ID);
  const skipped = rawDocs.length - documents.length + (rawTemplates.length - templates.length);
  const s = (d.settings ?? {}) as Partial<AppSettings>;
  return {
    ok: true,
    skipped,
    backup: {
      app: BACKUP_APP_ID,
      version: BACKUP_VERSION,
      exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : '',
      documents,
      templates,
      settings: { defaultTemplateId: typeof s.defaultTemplateId === 'string' ? s.defaultTemplateId : BUILTIN_TEMPLATE_ID },
    },
  };
}

/** รวมรายการตาม id — รายการที่นำเข้าจะแทนที่ของเดิมเฉพาะเมื่อแก้ไขล่าสุดใหม่กว่า */
export function mergeById<T extends { id: string; updatedAt: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((x) => [x.id, x]));
  for (const item of incoming) {
    const existing = map.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) map.set(item.id, item);
  }
  return [...map.values()];
}
