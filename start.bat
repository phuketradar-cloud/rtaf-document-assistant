@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ไม่พบ Node.js - โปรดติดตั้ง Node.js รุ่น LTS จาก https://nodejs.org ก่อน
  pause
  exit /b 1
)
if not exist node_modules (
  echo กำลังติดตั้งส่วนประกอบของโปรแกรม ครั้งแรกอาจใช้เวลาหลายนาที...
  call npm install
  if errorlevel 1 (
    echo ติดตั้งไม่สำเร็จ - ตรวจการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่
    pause
    exit /b 1
  )
)
echo กำลังเปิดโปรแกรม... เบราว์เซอร์จะเปิดที่ http://localhost:5173
echo ปิดหน้าต่างนี้เมื่อเลิกใช้งานโปรแกรม
call npm start
pause
