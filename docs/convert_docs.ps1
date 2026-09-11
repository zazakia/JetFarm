$word = New-Object -ComObject Word.Application
$word.Visible = $false

try {
    $doc = $word.Documents.Open("d:\GitHub\POS Cursor\docs\poscursor manual.doc")
    $doc.Content.Text | Out-File -FilePath "d:\GitHub\POS Cursor\docs\poscursor_manual_text.txt" -Encoding UTF8
    $doc.Close()
    Write-Host "Converted poscursor manual.doc"

    $doc2 = $word.Documents.Open("d:\GitHub\POS Cursor\docs\POSCURSOR Analysis.docx")
    $doc2.Content.Text | Out-File -FilePath "d:\GitHub\POS Cursor\docs\poscursor_analysis_text.txt" -Encoding UTF8
    $doc2.Close()
    Write-Host "Converted POSCURSOR Analysis.docx"
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
