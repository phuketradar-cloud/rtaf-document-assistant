# สร้างบันทึกข้อความตัวอย่างด้วย Microsoft Word จริง สำหรับทดสอบเมนู "เรียนรู้จากตัวอย่าง"
# ข้อความทั้งหมดเป็นข้อมูลสมมติสำหรับทดสอบ
# วิธีใช้:  powershell -ExecutionPolicy Bypass -File scripts\make-sample-memo.ps1
$ErrorActionPreference = 'Stop'
$out = Join-Path $PSScriptRoot '..\tests\fixtures'
New-Item -ItemType Directory -Force $out | Out-Null
[string]$path = Join-Path (Resolve-Path $out).Path 'word-memo.docx'

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Add()
  $cm = { param($v) $word.CentimetersToPoints($v) }
  $ps = $doc.PageSetup
  $ps.PaperSize = 7          # wdPaperA4
  $ps.TopMargin = & $cm 2
  $ps.BottomMargin = & $cm 2
  $ps.LeftMargin = & $cm 3
  $ps.RightMargin = & $cm 2

  $sel = $word.Selection
  $sel.ParagraphFormat.LineSpacingRule = 0   # wdLineSpaceSingle
  $sel.ParagraphFormat.SpaceAfter = 0
  $sel.ParagraphFormat.SpaceBefore = 0

  function Fmt([int]$size, [bool]$bold) {
    $sel.Font.Name = 'TH SarabunIT๙'; $sel.Font.NameBi = 'TH SarabunIT๙'
    $sel.Font.Size = $size; $sel.Font.SizeBi = $size
    $sel.Font.Bold = [int]$bold; $sel.Font.BoldBi = [int]$bold
  }
  function Para([int]$align, [double]$left, [double]$first) {
    $sel.ParagraphFormat.Alignment = $align
    $sel.ParagraphFormat.LeftIndent = & $cm $left
    $sel.ParagraphFormat.FirstLineIndent = & $cm $first
  }
  function Labeled($label, $value) {
    Fmt 16 $true; $sel.TypeText($label)
    Fmt 16 $false; $sel.TypeText("  $value")
  }

  Para 1 0 0; Fmt 29 $true; $sel.TypeText('บันทึกข้อความ'); $sel.TypeParagraph()
  Para 0 0 0; Labeled 'ส่วนราชการ' 'กองทดสอบ ฝ่ายทดสอบระบบ โทร. ๑๒๓๔'; $sel.TypeParagraph()
  $sel.ParagraphFormat.TabStops.ClearAll()
  $sel.ParagraphFormat.TabStops.Add((& $cm 9)) | Out-Null
  Labeled 'ที่' 'ทส ๐๖๒๑/๑๒๓'; $sel.TypeText("`t"); Labeled 'วันที่' '๒๓ ตุลาคม ๒๕๖๙'; $sel.TypeParagraph()
  $sel.ParagraphFormat.TabStops.ClearAll()
  Labeled 'เรื่อง' 'ขออนุมัติทดสอบระบบ'; $sel.TypeParagraph()
  Labeled 'เรียน' 'ผู้อำนวยการกองทดสอบ'; $sel.TypeParagraph()
  Labeled 'อ้างถึง' 'หนังสือ ทส ๐๖๒๑/๑ ลง ๑ ต.ค. ๖๙'; $sel.TypeParagraph()
  Labeled 'สิ่งที่ส่งมาด้วย' '๑. แบบฟอร์มทดสอบ จำนวน ๑ ชุด'; $sel.TypeParagraph()
  Para 0 2.75 0; Fmt 16 $false; $sel.TypeText('๒. รายชื่อทดสอบ จำนวน ๑ ชุด'); $sel.TypeParagraph()
  Para 9 0 2.5   # 9 = wdAlignParagraphThaiJustify (กระจายแบบไทย)
  $sel.TypeText('ตามที่ อ้างถึง กองทดสอบได้รับมอบหมายให้ทดสอบระบบจัดทำเอกสาร ซึ่งเป็นข้อความสมมติสำหรับการทดสอบเท่านั้น'); $sel.TypeParagraph()
  $sel.TypeText('ในการนี้ กองทดสอบจึงขออนุมัติดำเนินการทดสอบตามสิ่งที่ส่งมาด้วย'); $sel.TypeParagraph()
  $sel.TypeText('จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ'); $sel.TypeParagraph()
  Para 0 0 0; $sel.TypeParagraph(); $sel.TypeParagraph(); $sel.TypeParagraph()
  Para 1 7 0; $sel.TypeText('(นายทดสอบ ระบบดี)'); $sel.TypeParagraph()
  $sel.TypeText('ผู้อำนวยการกองทดสอบ')

  $doc.SaveAs([ref]$path, [ref]16)   # wdFormatDocumentDefault (.docx)
  $doc.Close([ref]0)
  Write-Host "สร้างไฟล์แล้ว: $path"
} finally {
  $word.Quit()
}
