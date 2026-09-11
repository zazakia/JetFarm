$word = New-Object -ComObject Word.Application
$word.Visible = $false

try {
    $htmlPath = "d:\GitHub\POS Cursor\docs\marketing_proposal.html"
    Write-Host "Opening HTML file: $htmlPath"
    $doc = $word.Documents.Open($htmlPath)
    
    # Configure document settings if needed (margins, page setup, etc.)
    $doc.PageSetup.TopMargin = $word.InchesToPoints(1.0)
    $doc.PageSetup.BottomMargin = $word.InchesToPoints(1.0)
    $doc.PageSetup.LeftMargin = $word.InchesToPoints(1.0)
    $doc.PageSetup.RightMargin = $word.InchesToPoints(1.0)
    
    # Save as DOCX (wdFormatXMLDocument is 12)
    $docxPath = "d:\GitHub\POS Cursor\docs\marketing_proposal.docx"
    $doc.SaveAs([ref]$docxPath, [ref]12)
    Write-Host "Successfully converted and saved: docs/marketing_proposal.docx"
    
    # Save as PDF (wdFormatPDF is 17)
    $pdfPath = "d:\GitHub\POS Cursor\docs\marketing_proposal.pdf"
    $doc.SaveAs([ref]$pdfPath, [ref]17)
    Write-Host "Successfully converted and saved: docs/marketing_proposal.pdf"
    
    $doc.Close()
} catch {
    Write-Error "Conversion failed: $_"
} finally {
    $word.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
}
