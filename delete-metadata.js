// delete-metadata.js
// Usage: node delete-metadata.js <filename>
// Deletes a local metadata file after confirming upload to IPFS/Pinata

const fs = require('fs');
const path = require('path');

const filename = process.argv[2];

if (!filename) {
  console.error('Usage: node delete-metadata.js <filename>');
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), filename);

fs.access(filePath, fs.constants.F_OK, (err) => {
  if (err) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error deleting file: ${err.message}`);
      process.exit(1);
    }
    console.log(`Deleted: ${filePath}`);
  });
});
