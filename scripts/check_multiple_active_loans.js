const { database } = require('../src/database'); // Adjusted for subdirectory
const { Q } = require('@nozbe/watermelondb');

async function checkMultipleActiveLoans() {
    try {
        const borrowerLoans = (await database.collections.get('loans').query(
            Q.where('status', 'active'),
            Q.where('deleted_at', Q.eq(null))
        ).fetch()).reduce((acc, loan) => {
            acc[loan.borrowerId] = (acc[loan.borrowerId] || []);
            acc[loan.borrowerId].push(loan);
            return acc;
        }, {});

        const violations = Object.entries(borrowerLoans).filter(([, lns]) => lns.length > 1);

        if (violations.length === 0) {
            console.log('No borrowers found with multiple active loans.');
        } else {
            console.log(`Found ${violations.length} violations:`);
            for (const [bId, lns] of violations) {
                const b = await database.collections.get('borrowers').find(bId);
                console.log(`Borrower: ${b.fullName} (${bId})`);
                lns.forEach(l => console.log(`  - ${l.loanNumber} (Created: ${new Date(l._raw.created_at)})`));
            }
        }
    } catch (e) {
        console.error(e);
    }
}
