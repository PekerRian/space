// /api/upload-metadata.js
import fetch from 'node-fetch';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    // Parse FormData for metadata fields and file
    const multiparty = (await import('multiparty')).default;
    const form = new multiparty.Form();
    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(400).json({ error: 'Invalid form data' });
      const name = fields.name?.[0];
      const space = fields.space?.[0];
      const description = fields.description?.[0];
      const image = fields.image?.[0];
      const maxSupply = fields.maxSupply?.[0] || 1;
      if (!name || !space || !description || !image) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      // 1. Create a temp folder
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'poap-meta-'));
      // 2. Write collection.json
      const collectionMeta = { name, space, description, image, type: 'collection' };
      await fs.writeFile(path.join(tmpDir, 'collection.json'), JSON.stringify(collectionMeta, null, 2));
      // 3. Write per-NFT metadata files
      for (let i = 1; i <= Number(maxSupply); i++) {
        const nftMeta = { name: `${name} #${i}`, description, image, type: 'nft' };
        await fs.writeFile(path.join(tmpDir, `${i}.json`), JSON.stringify(nftMeta, null, 2));
      }
      // 4. Pin the folder to IPFS (Pinata)
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      const tmpFiles = await fs.readdir(tmpDir);
      for (const file of tmpFiles) {
        const fileContent = await fs.readFile(path.join(tmpDir, file));
        formData.append('file', fileContent, file);
      }
      const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: formData,
      });
      const pinataData = await pinataRes.json();
      await fs.rm(tmpDir, { recursive: true, force: true });
      if (!pinataData.IpfsHash) return res.status(500).json({ error: 'Pinata upload failed' });
      res.status(200).json({ ipfsHash: pinataData.IpfsHash });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
