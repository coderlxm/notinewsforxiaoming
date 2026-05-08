const REQUIRED_MAJOR = 24;
const current = process.versions.node;
const major = Number(current.split('.')[0]);

if (major !== REQUIRED_MAJOR) {
  console.error(
    `[node-version] Node ${REQUIRED_MAJOR}.x is required (current: ${current}). ` +
    'Please switch to latest LTS Node 24 before starting the service.'
  );
  process.exit(1);
}

