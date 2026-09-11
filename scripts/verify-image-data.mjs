import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const imageData = [
  // Page 1 (Rows 1 - 28)
  { line: 1, name: 'Allen L. Gubalane', accountNo: 'AN-16-0001', amount2024: 2182.65, tsm: 2182.65 },
  { line: 2, name: 'April A. Hubahib', accountNo: 'AN-16-0002', amount2024: 1300.00, tsm: 1300.00 },
  { line: 3, name: 'Arnold C. Gonzales', accountNo: 'AN-16-0003', amount2024: 2267.34, tsm: 2267.34 },
  { line: 4, name: 'Elina Empimo', accountNo: 'AN-16-0004', amount2024: 750.00, tsm: 750.00 },
  { line: 5, name: 'Crisencia R. Ruiz', accountNo: 'AN-16-0005', amount2024: 7061.03, tsm: 7061.03 },
  { line: 6, name: 'Dennis M. Tolibao', accountNo: 'AN-16-0006', amount2024: 150.00, tsm: 150.00 },
  { line: 7, name: 'Dexter B. Jumao-as', accountNo: 'AN-16-0007', amount2024: 7500.71, tsm: 7500.71 },
  { line: 8, name: 'Dorotea Jumao-as', accountNo: 'AN-16-0008', amount2024: 8165.13, tsm: 8165.13 },
  { line: 9, name: 'Edgardo P. Nodalo', accountNo: 'AN-16-0009', amount2024: 2059.64, tsm: 2059.64 },
  { line: 10, name: 'Eloisa E. Williams', accountNo: 'AN-16-0010', amount2024: 2888.10, tsm: 2888.10 },
  { line: 11, name: 'Emmanuel C. Orellano', accountNo: 'AN-16-0011', amount2024: 700.00, tsm: 700.00 },
  { line: 12, name: 'Emmanuel S. Quilantang', accountNo: 'AN-16-0012', amount2024: 2120.79, tsm: 2120.79 },
  { line: 13, name: 'Erlinda E. Quilantang', accountNo: 'AN-16-0013', amount2024: 2162.62, tsm: 2162.62 },
  { line: 14, name: 'Eunicelle S. Samson', accountNo: 'AN-16-0014', amount2024: 5665.56, tsm: 5665.56 },
  { line: 15, name: 'Genelyn N. Ymas', accountNo: 'AN-16-0015', amount2024: 150.00, tsm: 150.00 },
  { line: 16, name: 'Junel A. Pagay', accountNo: 'AN-16-0016', amount2024: 1200.00, tsm: 1200.00 },
  { line: 17, name: 'Almuel P. Omega', accountNo: 'AN-16-0017', amount2024: 200.00, tsm: 200.00 },
  { line: 18, name: 'Ma. Ella P. Solano', accountNo: 'AN-16-0018', amount2024: 2465.95, tsm: 2465.95 },
  { line: 19, name: 'Maria Genia C. Seguido', accountNo: 'AN-16-0019', amount2024: 7173.27, tsm: 7173.27 },
  { line: 20, name: 'Mario G. Bañez Jr.', accountNo: 'AN-16-0020', amount2024: 1300.00, tsm: 1300.00 },
  { line: 21, name: 'Marissa B. Ligutan', accountNo: 'AN-16-0021', amount2024: 750.00, tsm: 750.00 },
  { line: 22, name: 'Maristela A. Mandras', accountNo: 'AN-16-0022', amount2024: 1200.00, tsm: 1200.00 },
  { line: 23, name: 'Mark Gil M. Catingub', accountNo: 'AN-16-0023', amount2024: 100.00, tsm: 100.00 },
  { line: 24, name: 'Mary Grace C. Perol', accountNo: 'AN-16-0024', amount2024: 2047.15, tsm: 2047.15 },
  { line: 25, name: 'Maricris Montemor', accountNo: 'AN-16-0025', amount2024: 600.00, tsm: 600.00 },
  { line: 26, name: 'Analyn Cabahug', accountNo: 'AN-16-0026', amount2024: 2939.77, tsm: 2939.77 },
  { line: 27, name: 'Nenita S. Fay', accountNo: 'AN-16-0027', amount2024: 2160.25, tsm: 2160.25 },
  { line: 28, name: 'Paul C. Espinosa', accountNo: 'AN-16-0028', amount2024: 2718.70, tsm: 2718.70 },

  // Page 2 (Rows 29 - 50)
  { line: 29, name: 'Raffy C. Banghet', accountNo: 'AN-16-0029', amount2024: 2059.64, tsm: 2059.64 },
  { line: 30, name: 'Rexie N. Costan', accountNo: 'AN-16-0030', amount2024: 2139.88, tsm: 2139.88 },
  { line: 31, name: 'Ricardo G. Amarille', accountNo: 'AN-16-0031', amount2024: 2689.70, tsm: 2689.70 },
  { line: 32, name: 'Rodina A. Alvarado', accountNo: 'AN-16-0032', amount2024: 2624.60, tsm: 2624.60 },
  { line: 33, name: 'Rolando C. Miaga', accountNo: 'AN-16-0033', amount2024: 1100.00, tsm: 1100.00 },
  { line: 34, name: 'Ronald P. Arcillas', accountNo: 'AN-16-0034', amount2024: 1000.00, tsm: 1000.00 },
  { line: 35, name: 'Victoriana A. Entero', accountNo: 'AN-16-0035', amount2024: 935.84, tsm: 935.84 },
  { line: 36, name: 'Jaime A. Cayetano Jr.', accountNo: 'AN-17-0036', amount2024: 300.00, tsm: 300.00 },
  { line: 37, name: 'Archie G. Bañez', accountNo: 'AN-17-0037', amount2024: 650.00, tsm: 650.00 },
  { line: 38, name: 'Ronan O. Sacay', accountNo: 'AN-17-0038', amount2024: 350.00, tsm: 350.00 },
  { line: 39, name: 'Edwin P. Caliwan', accountNo: 'AN-17-0039', amount2024: 150.00, tsm: 150.00 },
  { line: 40, name: 'Cort Wensley J. Balao', accountNo: 'AN-17-0040', amount2024: 2844.97, tsm: 2844.97 },
  { line: 41, name: 'PURISIMO C. ABRENILLO', accountNo: 'AN-17-0041', amount2024: 1450.54, tsm: 1450.54 },
  { line: 42, name: 'Marina S. Caparoso', accountNo: 'AN-17-0042', amount2024: 7061.03, tsm: 7061.03 },
  { line: 43, name: 'Merian C. Jumao-as', accountNo: 'AN-17-0043', amount2024: 7093.33, tsm: 7093.33 },
  { line: 44, name: 'Christopher D. Bioco', accountNo: 'AN-17-0044', amount2024: 2059.64, tsm: 2059.64 },
  { line: 45, name: 'Rahbie B. Jumao-as', accountNo: 'AN-17-0045', amount2024: 3465.23, tsm: 3465.23 },
  { line: 46, name: 'Shalou J. Balao', accountNo: 'AN-17-0046', amount2024: 7173.27, tsm: 7173.27 },
  { line: 47, name: 'Brice Vincent M. Jumao-as', accountNo: 'AN-17-0047', amount2024: 550.00, tsm: 550.00 },
  { line: 48, name: 'Agustin D. Bioco Jr.', accountNo: 'AN-17-0048', amount2024: 800.00, tsm: 800.00 },
  { line: 49, name: 'Jenelyn F. Jimenea', accountNo: 'AN-17-0049', amount2024: 5624.79, tsm: 5624.79 },
  { line: 50, name: 'Elvir P. Manriquez', accountNo: 'AN-18-0050', amount2024: 200.00, tsm: 200.00 },

  // Page 3 (Rows 51 - 77)
  { line: 51, name: 'Adelaida C. Manriquez', accountNo: 'AN-18-0051', amount2024: 200.00, tsm: 200.00 },
  { line: 52, name: 'Everth O. Acaso Jr.', accountNo: 'AN-18-0052', amount2024: 1550.00, tsm: 1550.00 },
  { line: 53, name: 'Isidro C. Lusanta Jr.', accountNo: 'AN-18-0053', amount2024: 2037.97, tsm: 2037.97 },
  { line: 54, name: 'CHECKY P. PEREZ', accountNo: 'AN-18-0054', amount2024: 100.00, tsm: 2020.00 },
  { line: 55, name: 'Brett Colin J. Balao', accountNo: 'AN-18-0055', amount2024: 2812.19, tsm: 2812.19 },
  { line: 56, name: 'Hazel Q. Bulacan', accountNo: 'AN-18-0056', amount2024: 2263.96, tsm: 2263.96 },
  { line: 57, name: 'Lloyd B. Bulacan', accountNo: 'AN-18-0057', amount2024: 2162.62, tsm: 2162.62 },
  { line: 58, name: 'Junlyn J. Aquino', accountNo: 'AN-18-0058', amount2024: 2511.80, tsm: 2511.80 },
  { line: 59, name: 'Concepcion B. Cruz', accountNo: 'AN-18-0059', amount2024: 7061.03, tsm: 7061.03 },
  { line: 60, name: 'Leonardo B. Cruz', accountNo: 'AN-18-0060', amount2024: 2582.58, tsm: 2582.58 },
  { line: 61, name: 'Annalyn B. Cruz', accountNo: 'AN-18-0061', amount2024: 2497.32, tsm: 2497.32 },
  { line: 62, name: 'ROWENA B. TELLIDUA', accountNo: 'AN-18-0062', amount2024: 4100.00, tsm: 4600.00 },
  { line: 63, name: 'Milben Rex P. Balao', accountNo: 'AN-18-0063', amount2024: 4800.86, tsm: 4800.86 },
  { line: 64, name: 'Ramil Mirafuentes', accountNo: 'AN-18-0064', amount2024: 100.00, tsm: 100.00 },
  { line: 65, name: 'Diosita J. Aquino', accountNo: 'AN-18-0065', amount2024: 2766.55, tsm: 2766.55 },
  { line: 66, name: 'Perpetuo O. Gaelo', accountNo: 'AN-18-0066', amount2024: 7311.71, tsm: 7331.71 },
  { line: 67, name: 'Marcial Raul S. Almacin', accountNo: 'AN-18-0067', amount2024: 2304.75, tsm: 2304.75 },
  { line: 68, name: 'Alma P. Bola', accountNo: 'AN-18-0068', amount2024: 220.00, tsm: 220.00 },
  { line: 69, name: 'Joventino C. Larrosa', accountNo: 'AN-18-0069', amount2024: 100.00, tsm: 100.00 },
  { line: 70, name: 'Kristine Joy Lusanta', accountNo: 'AN-19-0070', amount2024: 100.00, tsm: 100.00 },
  { line: 71, name: 'Milagros M. Villamor', accountNo: 'AN-19-0071', amount2024: 420.00, tsm: 420.00 },
  { line: 72, name: 'Salvador B. Villamor', accountNo: 'AN-19-0072', amount2024: 340.00, tsm: 340.00 },
  { line: 73, name: 'Ranilfa L. Amarille', accountNo: 'AN-19-0073', amount2024: 440.00, tsm: 480.00 },
  { line: 74, name: 'Rustom Montes', accountNo: 'AN-19-0074', amount2024: 520.00, tsm: 520.00 },
  { line: 75, name: 'Patricio Loyd Tellidua', accountNo: 'AN-19-0075', amount2024: 7561.03, tsm: 7561.03 },
  { line: 76, name: 'Ariel Romero', accountNo: 'AN-20-0076', amount2024: 200.00, tsm: 200.00 },
  { line: 77, name: 'Member 77', accountNo: 'AN-20-0077', amount2024: 340.00, tsm: 340.00 },

  // Page 4 (Rows 78 - 98)
  { line: 78, name: 'Richard S. Arar', accountNo: 'AN-20-0078', amount2024: 100.00, tsm: 100.00 },
  { line: 79, name: 'Tirso L. Cayanong', accountNo: 'AN-20-0079', amount2024: 421.82, tsm: 461.82 },
  { line: 80, name: 'Marie Angelie C. Mabag', accountNo: 'AN-20-0080', amount2024: 100.00, tsm: 100.00 },
  { line: 81, name: 'Jociel C. Esmero', accountNo: 'AN-20-0081', amount2024: 220.00, tsm: 240.00 },
  { line: 82, name: 'Ronelle C. Canete', accountNo: 'AN-20-0082', amount2024: 2404.02, tsm: 2444.02 },
  { line: 83, name: 'POSCURSOR ENTITY', accountNo: 'AN-20-0083', amount2024: 7061.03, tsm: 7061.03 },
  { line: 84, name: 'Jan Ros Y. Cormanes', accountNo: 'AN-20-0084', amount2024: 100.00, tsm: 100.00 },
  { line: 85, name: 'Bhrian Kelly D. Barquez', accountNo: 'AN-20-0085', amount2024: 100.00, tsm: 100.00 },
  { line: 86, name: 'Sabiniano D. Caparoso', accountNo: 'AN-20-0086', amount2024: 7061.03, tsm: 7081.03 },
  { line: 87, name: 'Marino B. Esoto', accountNo: 'AN-20-0087', amount2024: 7168.62, tsm: 7168.62 },
  { line: 88, name: 'Restituto L. Jumao-as', accountNo: 'AN-20-0088', amount2024: 3668.34, tsm: 3668.34 },
  { line: 89, name: 'POSCURSOR ENTITY', accountNo: 'AN-20-0089', amount2024: 2802.21, tsm: 2802.21 },
  { line: 90, name: 'POSCURSOR ENTITY', accountNo: 'AN-21-0090', amount2024: 1600.00, tsm: 3500.00 },
  { line: 91, name: 'Raquel C. Pabilan', accountNo: 'AN-21-0091', amount2024: 100.00, tsm: 100.00 },
  { line: 92, name: 'Antonio S. Perez Jr.', accountNo: 'AN-21-0092', amount2024: 3103.41, tsm: 3103.41 },
  { line: 93, name: 'Marben Caparoso', accountNo: 'AN-21-0093', amount2024: 100.00, tsm: 100.00 },
  { line: 94, name: 'Marlon C. Tampus', accountNo: 'AN-21-0094', amount2024: 2219.19, tsm: 2219.19 },
  { line: 95, name: 'Teresita A. Lozada', accountNo: 'AN-21-0095', amount2024: 250.00, tsm: 250.00 },
  { line: 96, name: 'Mark Dave Negad', accountNo: 'AN-21-0096', amount2024: 2269.62, tsm: 2269.62 },
  { line: 97, name: 'NOLI H. CAPAHI', accountNo: 'AN-21-0097', amount2024: 383.30, tsm: 383.30 },
  { line: 98, name: 'POSCURSOR ENTITY', accountNo: 'AN-21-0098', amount2024: 100.00, tsm: 100.00 }
];

async function verifyAllWithProd() {
  console.log('=== FULL PRODUCTION DB VERIFICATION (ALL 98 ROWS) ===\n');

  const { data: borrowers, error: bErr } = await supabase
    .from('app_borrowers')
    .select('*')
    .is('deleted_at', null);
  if (bErr) throw bErr;

  const { data: shareTx, error: sErr } = await supabase
    .from('app_share_capital_transactions')
    .select('*')
    .is('deleted_at', null);
  if (sErr) throw sErr;

  const { data: savTx, error: savErr } = await supabase
    .from('app_savings_transactions')
    .select('*')
    .is('deleted_at', null);
  if (savErr) throw savErr;

  console.log(`Production DB Totals: ${borrowers.length} borrowers, ${shareTx.length} share capital transactions, ${savTx.length} savings transactions.\n`);

  const borrowerByNum = new Map();
  const borrowerByName = new Map();

  for (const b of borrowers) {
    if (b.membership_number) {
      borrowerByNum.set(b.membership_number.trim().toUpperCase(), b);
    }
    if (b.full_name) {
      borrowerByName.set(b.full_name.trim().toLowerCase(), b);
    }
  }

  const shareBalByMemberId = new Map();
  for (const tx of shareTx) {
    const mId = tx.member_id || tx.borrower_id;
    if (!mId) continue;
    const current = shareBalByMemberId.get(mId) || 0;
    const amt = Number(tx.amount || 0);
    const type = (tx.transaction_type || '').toUpperCase();
    if (type === 'WITHDRAWAL' || type === 'DEBIT') {
      shareBalByMemberId.set(mId, current - amt);
    } else {
      shareBalByMemberId.set(mId, current + amt);
    }
  }

  const savBalByMemberId = new Map();
  for (const tx of savTx) {
    const mId = tx.borrower_id;
    if (!mId) continue;
    const current = savBalByMemberId.get(mId) || 0;
    const amt = Number(tx.amount || 0);
    savBalByMemberId.set(mId, current + amt);
  }

  let matchedCount = 0;
  let mismatchCount = 0;
  let missingInDbCount = 0;

  const results = [];

  for (const item of imageData) {
    let prodBorrower = borrowerByNum.get(item.accountNo.toUpperCase());
    if (!prodBorrower) {
      const cleanName = item.name.toLowerCase().replace(/[^a-z ]/g, '');
      for (const [bName, bObj] of borrowerByName.entries()) {
        const cleanBName = bName.replace(/[^a-z ]/g, '');
        if (cleanBName.includes(cleanName.split(' ')[0]) && cleanBName.includes(cleanName.split(' ').pop())) {
          prodBorrower = bObj;
          break;
        }
      }
    }

    if (!prodBorrower) {
      missingInDbCount++;
      results.push({
        Line: item.line,
        'Account No': item.accountNo,
        'Image Name': item.name,
        'Image 2024 Share': item.amount2024.toFixed(2),
        'Prod Name': 'NOT FOUND IN DB',
        'Prod Share Bal': 'N/A',
        'Prod Savings Bal': 'N/A',
        Status: '❌ NOT IN DB'
      });
      continue;
    }

    const prodShareBal = shareBalByMemberId.get(prodBorrower.id) ?? 0;
    const prodSavBal = savBalByMemberId.get(prodBorrower.id) ?? 0;

    const diffShare2024 = Math.abs(prodShareBal - item.amount2024);
    const diffShareTSM = Math.abs(prodShareBal - item.tsm);
    const diffSav = Math.abs(prodSavBal - item.amount2024);

    let status = '❌ MISMATCH';
    if (diffShareTSM < 0.01) {
      status = '✅ MATCH (TSM / Production Total)';
      matchedCount++;
    } else if (diffShare2024 < 0.01) {
      status = '✅ MATCH (Opening 2024 Share)';
      matchedCount++;
    } else if (diffSav < 0.01) {
      status = '✅ MATCH (Savings)';
      matchedCount++;
    } else {
      mismatchCount++;
    }

    results.push({
      Line: item.line,
      'Account No': item.accountNo,
      'Image Name': item.name,
      'Image 2024 Share': item.amount2024.toFixed(2),
      'Prod Name': prodBorrower.full_name,
      'Prod Share Bal': prodShareBal.toFixed(2),
      'Prod Savings Bal': prodSavBal.toFixed(2),
      Status: status
    });
  }

  console.table(results);

  console.log('\n====================================================');
  console.log('            FULL VERIFICATION SUMMARY');
  console.log('====================================================');
  console.log(`Total Rows in Report:            ${imageData.length}`);
  console.log(`Total Image 2024 Share Capital: ₱${imageData.reduce((s, i) => s + i.amount2024, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`Exact Matches in Production DB: ${matchedCount}`);
  console.log(`Mismatches in Production DB:    ${mismatchCount}`);
  console.log(`Missing in Production DB:       ${missingInDbCount}`);
  console.log('====================================================\n');
}

verifyAllWithProd().catch(console.error);
