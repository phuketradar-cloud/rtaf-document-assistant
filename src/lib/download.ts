/** ส่งไฟล์ให้เบราว์เซอร์ดาวน์โหลด (ทำงานในเครื่องทั้งหมด ไม่ส่งข้อมูลออกนอกเครื่อง) */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function downloadText(text: string, fileName: string, type = 'application/json') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), fileName);
}
