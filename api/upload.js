// /api/upload.js
// This endpoint uploads files to Pinata using a JWT set as the PINATA_JWT environment variable.
// Make sure to set PINATA_JWT in your Vercel project settings.
import { IncomingForm } from 'formidable';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

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
  const form = new IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Form parse error' });
    const file = files.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      console.log('Uploading file to Pinata:', file.originalFilename, file.mimetype, file.size);
      const data = fs.readFileSync(file.filepath);
      const formData = new FormData();
      formData.append('file', data, file.originalFilename);
      // Pinata JWT from environment variable
      if (!process.env.PINATA_JWT) {
        console.error('PINATA_JWT environment variable is not set');
        return res.status(500).json({ error: 'Pinata JWT not set in environment' });
      }
      const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: formData,
      });
      const pinataText = await pinataRes.text();
      let pinataData;
      try {
        pinataData = JSON.parse(pinataText);
      } catch (e) {
        console.error('Pinata non-JSON response:', pinataText);
        throw new Error('Pinata returned non-JSON response: ' + pinataText);
      }
      if (!pinataData.IpfsHash) {
        console.error('Pinata upload failed:', pinataData);
        throw new Error('Pinata upload failed: ' + JSON.stringify(pinataData));
      }
      console.log('Pinata upload success:', pinataData.IpfsHash);
      res.status(200).json({ ipfsHash: pinataData.IpfsHash });
    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ error: e.message });
    }
  });
}
