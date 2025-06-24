// /api/upload.js
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parse error' });
    const file = files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const data = fs.readFileSync(file.filepath);
      const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: (() => {
          const formData = new FormData();
          formData.append('file', data, file.originalFilename);
          return formData;
        })(),
      });
      const pinataData = await pinataRes.json();
      if (!pinataData.IpfsHash) throw new Error('Pinata upload failed');
      res.status(200).json({ ipfsHash: pinataData.IpfsHash });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
