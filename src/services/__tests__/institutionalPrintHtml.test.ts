import { buildLoanComputationSlipHtml, buildLoanContractFormsHtml } from '../institutionalPrintHtml';
import { institutionalPrintFixtures } from '../../../tests/fixtures/institutionalLoans';

jest.mock('../../utils/logoBase64', () => ({ logoBase64: 'data:image/png;base64,mock-logo' }));

function normalize(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('institutional print HTML builders', () => {
  for (const fixture of institutionalPrintFixtures) {
    it(`renders required computation and contract text for ${fixture.id}`, () => {
      const computationHtml = buildLoanComputationSlipHtml(fixture.borrower, fixture.loan, fixture.preparedBy);
      const contractHtml = buildLoanContractFormsHtml(fixture.borrower, fixture.loan);
      const text = normalize(`${computationHtml} ${contractHtml}`);

      for (const expected of fixture.expectedText) {
        expect(text).toContain(expected);
      }

      expect(text).toContain(fixture.borrower.address);
      expect(text).toContain(String(fixture.loan.term));
      expect(computationHtml).toContain('NET PROCEEDS');
      expect(computationHtml).toContain('class="brand-logo"');
      expect(computationHtml).toContain('data:image/png;base64,mock-logo');
      expect(contractHtml).toContain('Co-maker / Witness');
      expect(contractHtml).toContain('Loan No.');
      expect(contractHtml).toContain('class="brand-logo"');
    });
  }

  it('escapes borrower-controlled fields in printable forms', () => {
    const fixture = institutionalPrintFixtures[0];
    const html = buildLoanComputationSlipHtml(
      { fullName: '<script>alert(1)</script>', address: 'A & B < C' },
      fixture.loan,
      '<Encoder>'
    );

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('A &amp; B &lt; C');
    expect(html).toContain('&lt;Encoder&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
