import { test, expect, type Page } from '@playwright/test';
import { buildLoanComputationSlipHtml, buildLoanContractFormsHtml } from '../src/services/institutionalPrintHtml';
import { institutionalPrintFixtures } from './fixtures/institutionalLoans';

async function renderPrintHtml(page: Page, html: string) {
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
}

test.describe('Institutional loan print layout regression', () => {
  for (const fixture of institutionalPrintFixtures) {
    test(`${fixture.id} computation slip text and layout`, async ({ page }) => {
      const html = buildLoanComputationSlipHtml(fixture.borrower, fixture.loan, fixture.preparedBy);
      await renderPrintHtml(page, html);

      await expect(page.getByText('COMPUTATION SLIP')).toBeVisible();
      await expect(page.getByText(fixture.borrower.fullName)).toBeVisible();
      await expect(page.getByText(/NET PROCEEDS/).first()).toBeVisible();
      await expect(page.getByText(/TOTAL .*AMORTIZATION/)).toBeVisible();

      await expect(page).toHaveScreenshot(`${fixture.id}-computation-slip.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });

    test(`${fixture.id} contract forms text and layout`, async ({ page }) => {
      const html = buildLoanContractFormsHtml(fixture.borrower, fixture.loan);
      await renderPrintHtml(page, html);

      await expect(page.getByText('PROMISSORY NOTE')).toBeVisible();
      await expect(page.getByText('SWORN CERTIFICATION')).toBeVisible();
      await expect(page.getByText(fixture.borrower.fullName).first()).toBeVisible();
      await expect(page.getByText(/Co-maker \/ Witness/)).toBeVisible();

      await expect(page).toHaveScreenshot(`${fixture.id}-contract-forms.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});

