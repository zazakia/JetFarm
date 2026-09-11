const {
  standardDeductions,
  standardWeeklyAmortization,
} = require('./agap-migration-lib');

describe('AGAP Excel migration business rules', () => {
  it('matches GitHub issue weekly amortization for a PHP 5,000 standard loan', () => {
    expect(standardWeeklyAmortization(5000)).toEqual({
      weeklyPrincipal: 250,
      totalInterest: 1000,
      weeklyInterest: 50,
      weeklySavings: 50,
      lpf: 10,
      weeklyPayment: 360,
      totalReceivable: 7200,
    });
  });

  it('matches observed collection sheet weekly payment for a PHP 30,000 standard loan', () => {
    const result = standardWeeklyAmortization(30000);

    expect(result.totalInterest).toBe(6000);
    expect(result.weeklySavings).toBe(300);
    expect(result.weeklyPayment).toBe(2110);
    expect(result.totalReceivable).toBe(42200);
  });

  it('matches standard deduction issue for take-home amount', () => {
    expect(standardDeductions(5000)).toEqual({
      arf: 100,
      cpf: 200,
      mem: 100,
      lhf: 100,
      rsf: 60,
      docStamp: 45,
      previousBalance: 0,
      totalDeductions: 605,
      netProceeds: 4395,
    });
  });

  it('deducts previous balance when mapping a rollover', () => {
    const result = standardDeductions(10000, 1240);

    expect(result.totalDeductions).toBe(2145);
    expect(result.netProceeds).toBe(7855);
  });
});
