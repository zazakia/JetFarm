const bcrypt = require('bcryptjs');

const inputPass = process.argv[2] || '12345678';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(inputPass, salt);

console.log('Password:', inputPass);
console.log('Hash:', hash);
