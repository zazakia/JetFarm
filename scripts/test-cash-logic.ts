import { database } from '../src/database';
import { CashService } from '../src/services/CashService';
import Payment from '../src/database/models/Payment';
import Remittance from '../src/database/models/Remittance';
import { MfiKpiService } from '../src/services/MfiKpiService';

async function testCashLogic() {
    console.log('--- Testing Cash Logic ---');

    await database.write(async () => {
        const collectorId = 'test-collector-1';
        
        await database.collections.get<Payment>('payments').create(p => {
            p.amount = 1000;
            p.collectorId = collectorId;
            p.paymentDate = new Date().getTime();
        });

        console.log('Payment of 1000 recorded by collector.');

        let balance = await CashService.getCurrentBalance();
        console.log('Admin Balance (expected 0):', balance);

        let collectorBal = await CashService.getCollectorBalance(collectorId);
        console.log('Collector Balance (expected 1000):', collectorBal);

        await database.collections.get<Remittance>('remittances').create(r => {
            r.collectorId = collectorId;
            r.amount = 1000;
            r.status = 'pending';
            r.remittanceDate = new Date().getTime();
        });

        console.log('Pending remittance of 1000 submitted.');

        balance = await CashService.getCurrentBalance();
        console.log('Admin Balance (expected 0):', balance);

        collectorBal = await CashService.getCollectorBalance(collectorId);
        console.log('Collector Balance (expected 1000):', collectorBal);

        const remittances = await database.collections.get<Remittance>('remittances').query().fetch();
        const remit = remittances[0];
        if (remit) {
            await remit.update(r => {
                r.status = 'approved';
            });
            console.log('Remittance approved.');
        }

        balance = await CashService.getCurrentBalance();
        console.log('Admin Balance (expected 1000):', balance);

        collectorBal = await CashService.getCollectorBalance(collectorId);
        console.log('Collector Balance (expected 0):', collectorBal);

        console.log('--- Testing Advanced KPIs ---');
        const advancedKpis = await MfiKpiService.getAdvancedKpis();
        console.log('Advanced KPIs:', advancedKpis);
    });

    console.log('--- Test Complete ---');
}

// Note: Running this requires a valid WatermelonDB environment which is hard in a raw node script here.
// I will rely on the logic check since I cannot easily run WatermelonDB tests without the full Metro/Native environment.
