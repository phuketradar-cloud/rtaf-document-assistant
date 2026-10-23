import type { MemoFields } from '../src/types';
import { PAGE_BREAK_MARKER } from '../src/lib/fields';

/** ข้อมูลสำหรับการทดสอบเท่านั้น — ไม่ถูกนำเข้าไปในโปรแกรมหรือ Local Storage */
export function testFields(overrides: Partial<MemoFields> = {}): MemoFields {
  return {
    department: 'ทดสอบ-ส่วนราชการ กองทดสอบระบบ',
    docNumber: 'ทดสอบ 0001/2569',
    date: '2026-10-23',
    subject: 'ทดสอบการส่งออกเอกสารภาษาไทย',
    to: 'ทดสอบ-ผู้รับ',
    reference: 'ทดสอบอ้างถึง บรรทัดที่ ๑\nทดสอบอ้างถึง บรรทัดที่ ๒',
    enclosures: 'ทดสอบสิ่งที่ส่งมาด้วย จำนวน 1 ชุด',
    body:
      'ย่อหน้าทดสอบที่หนึ่ง มีสระและวรรณยุกต์ครบ เช่น ก่ ก้ ก๊ ก๋ กิ กี กึ กื กุ กู เก แก โก ใก ไก กำ ฯลฯ และข้อความยาวพอที่จะตัดบรรทัดเพื่อทดสอบการจัดย่อหน้าแบบกระจายแบบไทยในไฟล์ Word\n' +
      '\n' +
      'ย่อหน้าทดสอบที่สอง\n' +
      PAGE_BREAK_MARKER +
      '\nย่อหน้าทดสอบบนหน้าใหม่',
    closing: 'จึงเรียนมาเพื่อโปรดทดสอบ',
    signerName: 'ทดสอบ ผู้ลงนาม',
    signerPosition: 'ตำแหน่งทดสอบ\nบรรทัดที่สองของตำแหน่ง',
    ...overrides,
  };
}
