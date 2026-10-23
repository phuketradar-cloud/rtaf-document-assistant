# ทดสอบไฟล์ .docx ที่ได้จาก "npm test" ด้วย Microsoft Word จริง
# เปิดไฟล์แบบอ่านอย่างเดียว -> นับจำนวนหน้า -> บันทึกเป็น PDF ไว้ตรวจการจัดหน้า
# วิธีใช้:  powershell -ExecutionPolicy Bypass -File scripts\word-check.ps1
$ErrorActionPreference = 'Stop'
$outDir = Join-Path $PSScriptRoot '..\test-output' | Resolve-Path
$files = Get-ChildItem -Path $outDir -Filter *.docx
if (-not $files) { Write-Host 'ไม่พบไฟล์ .docx ใน test-output — รัน npm test ก่อน'; exit 1 }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$failed = 0
try {
  foreach ($f in $files) {
    try {
      $doc = $word.Documents.Open($f.FullName, $false, $true)
      $pages = $doc.ComputeStatistics(2)   # wdStatisticPages
      $font = $doc.Paragraphs(1).Range.Font.NameBi
      $pdf = [System.IO.Path]::ChangeExtension($f.FullName, '.pdf')
      $doc.SaveAs([ref]$pdf, [ref]17)       # wdFormatPDF
      $doc.Close([ref]0)
      Write-Host ("OK   {0}: {1} หน้า, ฟอนต์ภาษาไทยย่อหน้าแรก = {2}, PDF = {3}" -f $f.Name, $pages, $font, (Split-Path $pdf -Leaf))
    } catch {
      $failed++
      Write-Host ("FAIL {0}: {1}" -f $f.Name, $_.Exception.Message)
    }
  }
} finally {
  $word.Quit()
}
exit $failed
