const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
console.log(db.prepare("SELECT '2026-09-02T00:00:00.000Z' > datetime('now') as res").get());
