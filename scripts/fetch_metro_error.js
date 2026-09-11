const http = require('http');

const url = 'http://localhost:8082/index.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable';

http.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('--- RAW DATA (FIRST 500 CHARS) ---');
      console.log(data.substring(0, 500));
    }
  });
}).on('error', (err) => {
  console.error('Request failed:', err.message);
});
