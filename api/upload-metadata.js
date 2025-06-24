// /api/upload-metadata.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { name, space, description, image } = req.body || {};
    if (!name || !space || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const metadata = {
      name,
      space,
      description,
      image: image || '',
    };
    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: JSON.stringify({ pinataContent: metadata }),
    });
    const pinataData = await pinataRes.json();
    if (!pinataData.IpfsHash) throw new Error('Pinata upload failed');
    res.status(200).json({ ipfsHash: pinataData.IpfsHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
