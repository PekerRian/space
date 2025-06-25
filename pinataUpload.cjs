const express = require('express');
const multer = require('multer');
const PinataSDK = require('@pinata/sdk');
const cors = require('cors');
const { Readable } = require('stream');

// Use environment variables for Pinata API keys (set PINATA_API_KEY and PINATA_API_SECRET in your environment)
const pinata = new PinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
const upload = multer({ storage: multer.memoryStorage() }); // Ensure memory storage

const app = express();
app.use(cors());

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('Upload failed: No file uploaded');
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
    if (err.response) {
      // Pinata SDK error with response
      console.error('Pinata error response:', err.response.data || err.response);
    }
    if (req.file) {
      console.error('File info:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Metadata upload endpoint (no disk writes, uploads JSON from memory)
app.post('/upload-metadata', express.json(), async (req, res) => {
  try {
    const { name, space, description, image } = req.body;
    if (!name || !space || !description) {
      return res.status(400).json({ error: 'Missing required fields: name, space, description' });
    }
    // Build metadata JSON
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
    // Convert metadata to a buffer and create a readable stream
    const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
    const metadataStream = Readable.from(metadataBuffer);
    const fileName = `${name.replace(/[^a-zA-Z0-9-_]/g, '_')}-metadata.json`;
    // Upload the JSON to Pinata
    const result = await pinata.pinFileToIPFS(metadataStream, {
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
