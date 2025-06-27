// /api/upload-metadata.js
import fetch from 'node-fetch';
import formidable from 'formidable';
import pinataSDK from '@pinata/sdk';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    // Use formidable to parse the incoming form data
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(400).json({ error: 'Invalid form data' });
      const name = fields.name;
      const space = fields.space;
      const description = fields.description;
      const image = fields.image;
      const maxSupply = fields.maxSupply || 1;
      if (!name || !space || !description || !image) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      // Create in-memory metadata files
      const collectionMeta = { name, space, description, image, type: 'collection' };
      const filesToUpload = [
        { filename: 'collection.json', content: Buffer.from(JSON.stringify(collectionMeta, null, 2)) }
      ];
      for (let i = 1; i <= Number(maxSupply); i++) {
        const nftMeta = { name: `${name} #${i}`, description, image, type: 'nft' };
        filesToUpload.push({ filename: `${i}.json`, content: Buffer.from(JSON.stringify(nftMeta, null, 2)) });
      }
      // Pin the files to IPFS (Pinata) as a folder using Pinata SDK
      if (!process.env.PINATA_JWT) {
        return res.status(500).json({ error: 'Pinata JWT is missing from environment variables.' });
      }
      const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });
      // Create a temp directory and write files for SDK folder upload
      const fs = await import('fs/promises');
      const os = await import('os');
      const path = await import('path');
      const tmpDir = await fs.mkdtemp(path.default.join(os.default.tmpdir(), 'poap-meta-'));
      for (const file of filesToUpload) {
        await fs.writeFile(path.default.join(tmpDir, file.filename), file.content);
      }
      try {
        const result = await pinata.pinFromFS(tmpDir, { pinataOptions: { wrapWithDirectory: true } });
        await fs.rm(tmpDir, { recursive: true, force: true });
        if (!result.IpfsHash) {
          console.error('Pinata SDK upload failed. Response:', result);
          return res.status(500).json({ error: 'Pinata upload failed', pinata: result });
        }
        res.status(200).json({ ipfsHash: result.IpfsHash });
      } catch (sdkErr) {
        await fs.rm(tmpDir, { recursive: true, force: true });
        console.error('Pinata SDK upload failed. Error:', sdkErr);
        return res.status(500).json({ error: 'Pinata upload failed', pinata: sdkErr.message || sdkErr });
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
