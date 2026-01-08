'use strict';

const pkg = require('./package.json');

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  t402 - The Tether Payment Protocol                          ║
║  Package: ${pkg.name}
║  Website: https://t402.io                                    ║
║  Full implementation coming soon!                            ║
╚══════════════════════════════════════════════════════════════╝
`);

module.exports = {
  version: pkg.version,
  name: pkg.name,
  website: 'https://t402.io'
};
