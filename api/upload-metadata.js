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
    const { name, space, description, image, maxSupply = 1 } = req.body || {};
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
    const formData = new FormData();
    const files = await fs.readdir(tmpDir);
    for (const file of files) {
      formData.append('file', await fs.readFile(path.join(tmpDir, file)), file);
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
    if (!pinataData.IpfsHash) throw new Error('Pinata upload failed');
    res.status(200).json({ ipfsHash: pinataData.IpfsHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
