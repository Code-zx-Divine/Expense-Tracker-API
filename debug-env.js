const fs = require('fs');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  console.log('File content length:', content.length);

  const env = {};
  const lines = content.split('\n');
  console.log('Total lines:', lines.length);

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    console.log(`Line ${idx + 1}: length=${line.length}, trimmed="${trimmed.substring(0, 50)}"`);

    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const eqIndex = trimmed.indexOf('=');
    console.log(`  -> eqIndex: ${eqIndex}`);

    if (eqIndex === -1) {
      return;
    }

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    console.log(`  -> key: "${key}", value start: "${value.substring(0, 30)}"`);

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
      console.log(`  -> after quote removal: "${value.substring(0, 30)}"`);
    }

    env[key] = value;
  });

  return env;
}

const env = loadEnvFile('.env');
console.log('\nResult:');
console.log('Has MONGODB_URI:', 'MONGODB_URI' in env);
console.log('MONGODB_URI value:', env.MONGODB_URI ? env.MONGODB_URI.substring(0, 60) + '...' : 'NOT FOUND');
