$word = New-Object -ComObject Word.Application
$word.Visible = $false

try {
    $htmlPath = "d:\GitHub\POS Cursor\docs\user_manual.html"
    Write-Host "Opening HTML file: $htmlPath"
    $doc = $word.Documents.Open($htmlPath)
    
    # Save as DOCX
    $docxPath = "d:\GitHub\POS Cursor\docs\user_manual.docx"
    # wdFormatXMLDocument is 12
    $doc.SaveAs([ref]$docxPath, [ref]12)
    Write-Host "Successfully converted and saved: docs/user_manual.docx"
    
    # Save as PDF
    $pdfPath = "d:\GitHub\POS Cursor\docs\user_manual.pdf"
    # wdFormatPDF is 17
    $doc.SaveAs([ref]$pdfPath, [ref]17)
    Write-Host "Successfully converted and saved: docs/user_manual.pdf"
    
    $doc.Close()
} catch {
    Write-Error "Conversion failed: $_"
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
