import type { FieldKey, ValidationIssue } from '../types';
import { countBySeverity } from '../lib/validation';

const SEVERITY_LABEL = { error: 'ข้อผิดพลาด', warning: 'ควรตรวจสอบ', info: 'ข้อสังเกต' };

export default function ValidationPanel({
  issues,
  onSelectField,
}: {
  issues: ValidationIssue[];
  onSelectField: (field: FieldKey) => void;
}) {
  const c = countBySeverity(issues);
  return (
    <section className="validation-panel" aria-label="ผลการตรวจสอบ">
      <h2>ผลการตรวจเบื้องต้น</h2>
      <p className="hint">
        เป็นการตรวจอัตโนมัติเบื้องต้นเท่านั้น ไม่ใช่การรับรองว่าเอกสารถูกต้องตามระเบียบ และโปรแกรมจะไม่แก้ไขข้อมูลให้เอง
      </p>
      <div className="validation-summary">
        <span className="pill error">{SEVERITY_LABEL.error} {c.error}</span>
        <span className="pill warning">{SEVERITY_LABEL.warning} {c.warning}</span>
        <span className="pill info">{SEVERITY_LABEL.info} {c.info}</span>
      </div>
      {issues.length === 0 ? (
        <p>ไม่พบรายการที่ต้องตรวจจากการตรวจเบื้องต้น</p>
      ) : (
        <ul className="issue-list">
          {issues.map((i) => (
            <li key={i.id} className={i.severity}>
              <div className="issue-head">
                <span className={`pill ${i.severity}`}>{SEVERITY_LABEL[i.severity]}</span>
                {i.field ? (
                  <button type="button" className="link-btn" onClick={() => onSelectField(i.field!)}>
                    {i.message}
                  </button>
                ) : (
                  <span>{i.message}</span>
                )}
              </div>
              <div className="issue-fix">วิธีแก้: {i.suggestion}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
