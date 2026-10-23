import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, DocumentRecord, MemoFields, MemoTemplate } from '../types';
import {
  clearAll,
  DEFAULT_SETTINGS,
  loadDocuments,
  loadSettings,
  loadUserTemplates,
  saveDocuments,
  saveSettings,
  saveUserTemplates,
  StorageError,
} from '../lib/storage';
import { BUILTIN_TEMPLATE, BUILTIN_TEMPLATE_ID } from '../lib/templates';
import { newId } from '../lib/fields';

export type NoticeKind = 'success' | 'error' | 'info';
export interface Notice {
  id: string;
  kind: NoticeKind;
  text: string;
}

interface State {
  documents: DocumentRecord[];
  userTemplates: MemoTemplate[];
  settings: AppSettings;
}

interface AppDataValue {
  documents: DocumentRecord[];
  /** แม่แบบทั้งหมด (แม่แบบเริ่มต้นของโปรแกรมอยู่ลำดับแรก) */
  templates: MemoTemplate[];
  settings: AppSettings;
  notices: Notice[];
  notify: (kind: NoticeKind, text: string) => void;
  dismissNotice: (id: string) => void;
  saveDocument: (doc: DocumentRecord) => boolean;
  deleteDocument: (id: string) => boolean;
  duplicateDocument: (id: string) => DocumentRecord | null;
  saveTemplate: (t: MemoTemplate) => boolean;
  deleteTemplate: (id: string) => boolean;
  updateSettings: (s: AppSettings) => boolean;
  replaceAll: (docs: DocumentRecord[], templates: MemoTemplate[], settings: AppSettings) => boolean;
  clearAllData: () => boolean;
  /** หน้าแก้ไขลงทะเบียนฟังก์ชันตรวจว่ามีการแก้ไขที่ยังไม่บันทึกหรือไม่ */
  setLeaveGuard: (guard: (() => boolean) | null) => void;
  leaveGuardRef: React.MutableRefObject<(() => boolean) | null>;
  /** ข้อมูลตั้งต้นสำหรับ “เอกสารใหม่” ครั้งถัดไป (จากหน้าเรียนรู้) — ไม่ถูกบันทึกจนกว่าผู้ใช้กดบันทึก */
  newDocPrefillRef: React.MutableRefObject<{ templateId: string; fields: Partial<MemoFields> } | null>;
}

const Ctx = createContext<AppDataValue | null>(null);

function initialState(): { state: State; error?: string } {
  try {
    return { state: { documents: loadDocuments(), userTemplates: loadUserTemplates(), settings: loadSettings() } };
  } catch (e) {
    return {
      state: { documents: [], userTemplates: [], settings: { ...DEFAULT_SETTINGS } },
      error: e instanceof Error ? e.message : 'อ่านข้อมูลที่บันทึกไว้ไม่สำเร็จ',
    };
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [init] = useState(initialState);
  const [state, setState] = useState<State>(init.state);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [notices, setNotices] = useState<Notice[]>(
    init.error ? [{ id: 'load-error', kind: 'error', text: init.error }] : [],
  );
  const leaveGuardRef = useRef<(() => boolean) | null>(null);
  const newDocPrefillRef = useRef<{ templateId: string; fields: Partial<MemoFields> } | null>(null);

  const dismissNotice = useCallback((id: string) => setNotices((n) => n.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (kind: NoticeKind, text: string) => {
      const id = newId();
      setNotices((n) => [...n.slice(-3), { id, kind, text }]);
      if (kind !== 'error') setTimeout(() => dismissNotice(id), 8000);
    },
    [dismissNotice],
  );

  /** บันทึกลง Local Storage ก่อน แล้วจึงอัปเดตหน้าจอ — ถ้าบันทึกไม่ได้จะไม่เปลี่ยนข้อมูลบนจอ */
  const commit = useCallback(
    (next: Partial<State>): boolean => {
      try {
        if (next.documents) saveDocuments(next.documents);
        if (next.userTemplates) saveUserTemplates(next.userTemplates);
        if (next.settings) saveSettings(next.settings);
      } catch (e) {
        notify('error', e instanceof StorageError ? e.message : 'บันทึกข้อมูลไม่สำเร็จ โปรดลองอีกครั้ง');
        return false;
      }
      const merged = { ...stateRef.current, ...next };
      stateRef.current = merged;
      setState(merged);
      return true;
    },
    [notify],
  );

  const value = useMemo<AppDataValue>(() => {
    const templates = [BUILTIN_TEMPLATE, ...state.userTemplates];
    return {
      documents: state.documents,
      templates,
      settings: state.settings,
      notices,
      notify,
      dismissNotice,
      saveDocument: (doc) => {
        const docs = stateRef.current.documents;
        const exists = docs.some((d) => d.id === doc.id);
        return commit({ documents: exists ? docs.map((d) => (d.id === doc.id ? doc : d)) : [...docs, doc] });
      },
      deleteDocument: (id) => commit({ documents: stateRef.current.documents.filter((d) => d.id !== id) }),
      duplicateDocument: (id) => {
        const src = stateRef.current.documents.find((d) => d.id === id);
        if (!src) return null;
        const now = new Date().toISOString();
        const copy: DocumentRecord = {
          ...src,
          id: newId(),
          status: 'draft',
          fields: { ...src.fields },
          createdAt: now,
          updatedAt: now,
          lastExportedAt: undefined,
          copiedFromId: src.id,
        };
        return commit({ documents: [...stateRef.current.documents, copy] }) ? copy : null;
      },
      saveTemplate: (t) => {
        if (t.builtIn) return false;
        const list = stateRef.current.userTemplates;
        const exists = list.some((x) => x.id === t.id);
        return commit({ userTemplates: exists ? list.map((x) => (x.id === t.id ? t : x)) : [...list, t] });
      },
      deleteTemplate: (id) => {
        const s = stateRef.current;
        const next: Partial<State> = { userTemplates: s.userTemplates.filter((t) => t.id !== id) };
        if (s.settings.defaultTemplateId === id) next.settings = { ...s.settings, defaultTemplateId: BUILTIN_TEMPLATE_ID };
        return commit(next);
      },
      updateSettings: (settings) => commit({ settings }),
      replaceAll: (documents, userTemplates, settings) =>
        commit({ documents, userTemplates: userTemplates.filter((t) => !t.builtIn), settings }),
      clearAllData: () => {
        try {
          clearAll();
        } catch (e) {
          notify('error', e instanceof Error ? e.message : 'ลบข้อมูลไม่สำเร็จ');
          return false;
        }
        const empty: State = { documents: [], userTemplates: [], settings: { ...DEFAULT_SETTINGS } };
        stateRef.current = empty;
        setState(empty);
        return true;
      },
      setLeaveGuard: (guard) => {
        leaveGuardRef.current = guard;
      },
      leaveGuardRef,
      newDocPrefillRef,
    };
  }, [state, notices, notify, dismissNotice, commit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData ต้องใช้ภายใน AppDataProvider');
  return v;
}
