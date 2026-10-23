import type { AppSettings, DocumentRecord, MemoTemplate } from '../types';
import { normalizeFields } from './fields';
import { BUILTIN_TEMPLATE_ID, normalizeTemplate } from './templates';

/**
 * เก็บเฉพาะข้อมูลเอกสารทั่วไป แม่แบบ และการตั้งค่า
 * ห้ามเก็บรหัสผ่านหรือข้อมูลลับในที่นี้ (Local Storage ไม่ได้เข้ารหัส)
 */
export const STORAGE_KEYS = {
  documents: 'rtafda.documents.v1',
  templates: 'rtafda.templates.v1',
  settings: 'rtafda.settings.v1',
} as const;

export class StorageError extends Error {}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function store(): KeyValueStore {
  if (typeof localStorage === 'undefined') throw new StorageError('เบราว์เซอร์นี้ไม่รองรับการจัดเก็บข้อมูล (Local Storage)');
  return localStorage;
}

function readJson(key: string, s: KeyValueStore): unknown {
  const raw = s.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown, s: KeyValueStore = store()) {
  try {
    s.setItem(key, JSON.stringify(value));
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    throw new StorageError(
      quota
        ? 'พื้นที่จัดเก็บในเบราว์เซอร์เต็ม — โปรดสำรองข้อมูลแล้วลบเอกสารที่ไม่ใช้ออก'
        : 'บันทึกข้อมูลไม่สำเร็จ — ตรวจว่าเบราว์เซอร์ไม่ได้ปิดการจัดเก็บข้อมูล (เช่น โหมดไม่ระบุตัวตน)',
    );
  }
}

export function normalizeDocument(input: unknown): DocumentRecord | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as Record<string, unknown>;
  if (typeof d.id !== 'string' || !d.id) return null;
  const now = new Date().toISOString();
  return {
    id: d.id,
    type: 'memo',
    templateId: typeof d.templateId === 'string' ? d.templateId : BUILTIN_TEMPLATE_ID,
    status: d.status === 'exported' ? 'exported' : 'draft',
    fields: normalizeFields(d.fields),
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : now,
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : now,
    lastExportedAt: typeof d.lastExportedAt === 'string' ? d.lastExportedAt : undefined,
    copiedFromId: typeof d.copiedFromId === 'string' ? d.copiedFromId : undefined,
  };
}

export function loadDocuments(s: KeyValueStore = store()): DocumentRecord[] {
  const data = readJson(STORAGE_KEYS.documents, s);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeDocument).filter((d): d is DocumentRecord => d !== null);
}

/** แม่แบบที่ผู้ใช้สร้าง (ไม่รวมแม่แบบเริ่มต้นของโปรแกรม) */
export function loadUserTemplates(s: KeyValueStore = store()): MemoTemplate[] {
  const data = readJson(STORAGE_KEYS.templates, s);
  if (!Array.isArray(data)) return [];
  return data
    .map(normalizeTemplate)
    .filter((t): t is MemoTemplate => t !== null && t.id !== BUILTIN_TEMPLATE_ID);
}

export function loadSettings(s: KeyValueStore = store()): AppSettings {
  const data = readJson(STORAGE_KEYS.settings, s) as Partial<AppSettings> | null;
  return {
    defaultTemplateId: typeof data?.defaultTemplateId === 'string' ? data.defaultTemplateId : BUILTIN_TEMPLATE_ID,
  };
}

export function saveDocuments(docs: DocumentRecord[], s?: KeyValueStore) {
  writeJson(STORAGE_KEYS.documents, docs, s);
}
export function saveUserTemplates(templates: MemoTemplate[], s?: KeyValueStore) {
  writeJson(STORAGE_KEYS.templates, templates.filter((t) => !t.builtIn), s);
}
export function saveSettings(settings: AppSettings, s?: KeyValueStore) {
  writeJson(STORAGE_KEYS.settings, settings, s);
}

export function clearAll(s: KeyValueStore = store()) {
  for (const key of Object.values(STORAGE_KEYS)) s.removeItem(key);
}

/** ขนาดข้อมูลของโปรแกรมใน Local Storage (ไบต์ โดยประมาณ) */
export function storageUsageBytes(s: KeyValueStore = store()): number {
  let total = 0;
  for (const key of Object.values(STORAGE_KEYS)) total += (s.getItem(key)?.length ?? 0) * 2;
  return total;
}
