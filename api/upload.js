// /api/upload.js
import formidable from 'formidable';
import fs from 'fs';

// Use this handler as a Vercel serverless function
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
      // Use Pinata or your preferred IPFS service here
      // Example: return a fake hash for demo
      res.status(200).json({ ipfsHash: 'QmFakeHashForDemo' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
