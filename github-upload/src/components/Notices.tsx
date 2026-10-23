import { useAppData } from '../state/AppData';

const TITLES = { success: 'สำเร็จ', error: 'เกิดข้อผิดพลาด', info: 'แจ้งให้ทราบ' };

export default function Notices() {
  const { notices, dismissNotice } = useAppData();
  if (!notices.length) return null;
  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`notice notice-${n.kind}`}>
          <div>
            <strong>{TITLES[n.kind]}</strong>
            <div>{n.text}</div>
          </div>
          <button className="notice-close" onClick={() => dismissNotice(n.id)} aria-label="ปิดข้อความ">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
