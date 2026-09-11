try {
    $outlook = New-Object -ComObject Outlook.Application
    # Create mail item (0 is olMailItem)
    $mail = $outlook.CreateItem(0)
    $mail.To = "cybergada@gmail.com"
    $mail.Subject = "POSCursor Generated Proposal Documents"
    
    $bodyText = "Hello,`r`n`r`nHere are the generated marketing and proposal documents for POSCursor (POS Cursor LMS).`r`n`r`nFiles Attached:`r`n1. marketing_proposal.docx (MS Word version)`r`n2. marketing_proposal.pdf (PDF version)`r`n`r`nBest regards,`r`nPOSCursor Business Solutions Team"
    $mail.Body = $bodyText
    
    # Absolute paths to attachments
    $docxPath = "d:\GitHub\POS Cursor\docs\marketing_proposal.docx"
    $pdfPath = "d:\GitHub\POS Cursor\docs\marketing_proposal.pdf"
    
    if (Test-Path $docxPath) {
        $mail.Attachments.Add($docxPath) | Out-Null
        Write-Host "Attached docx file."
    } else {
        Write-Warning "Docx file not found at $docxPath"
    }
    
    if (Test-Path $pdfPath) {
        $mail.Attachments.Add($pdfPath) | Out-Null
        Write-Host "Attached pdf file."
    } else {
        Write-Warning "Pdf file not found at $pdfPath"
    }
    
    Write-Host "Displaying the email composition window in Outlook..."
    $mail.Display()
    Write-Host "Email draft displayed successfully in Outlook. Please click 'Send' in Outlook."
} catch {
    Write-Error "Failed to display email window: $_"
}
