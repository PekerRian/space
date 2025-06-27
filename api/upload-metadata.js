// /api/upload-metadata.js
import fetch from 'node-fetch';
import formidable from 'formidable';

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
      // Pin the files to IPFS (Pinata) as a folder
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      for (const file of filesToUpload) {
        formData.append('file', file.content, { filename: file.filename, filepath: file.filename });
      }
      // Tell Pinata to wrap files in a directory
      formData.append('pinataOptions', JSON.stringify({ wrapWithDirectory: true }));
      const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        },
        body: formData,
      });
      const pinataData = await pinataRes.json();
      if (!pinataData.IpfsHash) return res.status(500).json({ error: 'Pinata upload failed' });
      res.status(200).json({ ipfsHash: pinataData.IpfsHash });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
