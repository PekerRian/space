const express = require('express');
const multer = require('multer');
const PinataSDK = require('@pinata/sdk');
const cors = require('cors');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

// Replace with your actual Pinata API Key and Secret
const pinata = new PinataSDK('a93ecc32760e91f60533', '691e79ab1074435587915825241a52b9294802acf9f34181f64ea51fd7c7968c');
const upload = multer({ storage: multer.memoryStorage() }); // Ensure memory storage

const app = express();
app.use(cors());

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log('Received file:', req.file.originalname, req.file.mimetype, req.file.size);
    // Pinata expects a Readable stream, so wrap the buffer
    const fileStream = Readable.from(req.file.buffer);
    const result = await pinata.pinFileToIPFS(fileStream, {
      pinataMetadata: { name: req.file.originalname }
    });
    console.log('Pinata result:', result);
    res.json({ ipfsHash: result.IpfsHash });
  } catch (err) {
    console.error('Pinata error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/upload-metadata', express.json(), async (req, res) => {
  try {
    const { name, space, description, image } = req.body;
    if (!name || !space || !description) {
      return res.status(400).json({ error: 'Missing required fields: name, space, description' });
    }
    // Save the metadata as a JSON file for NFT metadata
    const metadata = {
      name,
      description,
      attributes: [
        { trait_type: 'space', value: space }
      ]
    };
    if (image) {
      metadata.image = image;
    }
    // Write the JSON file to disk (optional, for your own records)
    const fileName = `${name.replace(/[^a-zA-Z0-9-_]/g, '_')}-metadata.json`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
    // Upload the JSON to Pinata
    const fileStream = fs.createReadStream(filePath);
    const result = await pinata.pinFileToIPFS(fileStream, {
      pinataMetadata: { name: fileName }
    });
    console.log('Pinata metadata file result:', result);
    res.json({ ipfsHash: result.IpfsHash, metadata });
  } catch (err) {
    console.error('Pinata metadata error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(5001, () => console.log('Pinata upload server running on port 5001'));

// No changes needed for Pinata upload backend for Aptos network selection.
// To change your dApp to use Aptos testnet, update your frontend:
// In your React app, set Network.TESTNET instead of Network.MAINNET in App.jsx:
// dappConfig={{ network: Network.TESTNET }}
