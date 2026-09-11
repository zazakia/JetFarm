try {
    $outlook = New-Object -ComObject Outlook.Application
    # 0 is the olMailItem constant
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
    
    Write-Host "Attempting to send email..."
    $mail.Send()
    Write-Host "Email sent successfully to cybergada@gmail.com via Outlook!"
} catch {
    Write-Warning "Direct send failed (Outlook security or configuration issue). Error: $_"
    try {
        Write-Host "Attempting to display the email composition window as fallback..."
        $mail.Display()
        Write-Host "Email window displayed successfully. Please review and click 'Send' in Outlook."
    } catch {
        Write-Error "Failed to display email: $_"
    }
}
