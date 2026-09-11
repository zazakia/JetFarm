async function main() {
  console.log('Testing Expo dev server at http://localhost:8088...');
  try {
    const res = await fetch('http://localhost:8088');
    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      console.log('[OK] Dev server responded cleanly with 200 OK.');
    }
  } catch (err) {
    console.error('Error connecting to dev server:', err.message);
  }
}

main();
