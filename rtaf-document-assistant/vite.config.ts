import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// ใช้พอร์ตเดียวกันทั้งโหมดพัฒนาและโหมดใช้งาน เพราะ Local Storage แยกตามพอร์ต
// ถ้าพอร์ตเปลี่ยน ข้อมูลที่บันทึกไว้จะ "หายไป" จากมุมมองของผู้ใช้
const PORT = 5173;

export default defineConfig({
  plugins: [react()],
  base: './',
  // ไลบรารี docx มีขนาดใหญ่ แต่โปรแกรมโหลดจากเครื่องตัวเอง จึงไม่เป็นปัญหา
  build: { chunkSizeWarningLimit: 1000 },
  server: { port: PORT, strictPort: true, host: 'localhost' },
  preview: { port: PORT, strictPort: true, host: 'localhost' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
