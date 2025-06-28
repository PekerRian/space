// /api/upload-metadata.js
import fetch from 'node-fetch';
import formidable from 'formidable';
import pinataSDK from '@pinata/sdk';

export const config = {
  api: {
    bodyParser: false,
  },
};

// If Firebase failed to initialize, always return JSON error
const exportedHandler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    // Use formidable to parse the incoming form data
    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
      try {
        if (err) {
          console.error('Formidable parse error:', err);
          return res.status(400).json({ error: 'Invalid form data', details: err.message || err });
        }
        // Ensure all fields are strings, not arrays
        const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
        const space = Array.isArray(fields.space) ? fields.space[0] : fields.space;
        const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
        const image = Array.isArray(fields.image) ? fields.image[0] : fields.image;
        const maxSupply = Array.isArray(fields.maxSupply) ? fields.maxSupply[0] : fields.maxSupply || 1;
        if (!name || !space || !description || !image) {
          console.error('Missing required fields:', { name, space, description, image });
          return res.status(400).json({ error: 'Missing required fields', fields: { name, space, description, image } });
        }
        // Create in-memory metadata files
        const collectionMeta = { name, space, description, image, type: 'collection' };
        const filesToUpload = [
          { filename: 'collection.json', content: Buffer.from(JSON.stringify(collectionMeta, null, 2)) }
        ];
        // Use 'limit' for the number of NFT metadata files, fallback to maxSupply or 1
        let limit = 1;
        if (fields.limit !== undefined) {
          limit = parseInt(Array.isArray(fields.limit) ? fields.limit[0] : fields.limit, 10);
        } else if (fields.maxSupply !== undefined) {
          limit = parseInt(Array.isArray(fields.maxSupply) ? fields.maxSupply[0] : fields.maxSupply, 10);
        }
        if (isNaN(limit) || limit < 1) limit = 1;
        for (let i = 1; i <= limit; i++) {
          const nftMeta = { name: `${name} #${i}`, description, image, type: 'nft' };
          filesToUpload.push({ filename: `${i}.json`, content: Buffer.from(JSON.stringify(nftMeta, null, 2)) });
        }
        // Pin the files to IPFS (Pinata) as a folder using Pinata SDK
        if (!process.env.PINATA_JWT) {
          console.error('Pinata JWT is missing from environment variables.');
          return res.status(500).json({ error: 'Pinata JWT is missing from environment variables.' });
        }
        const pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });
        // Create a temp directory and write files for SDK folder upload
        const fs = await import('fs/promises');
        const os = await import('os');
        const path = await import('path');    
        let tmpDir;
        try {
          tmpDir = await fs.mkdtemp(path.default.join(os.default.tmpdir(), 'poap-meta-'));
          for (const file of filesToUpload) {
            await fs.writeFile(path.default.join(tmpDir, file.filename), file.content);
          }
          // Get the subfolder name (basename of tmpDir)
          const subfolder = path.default.basename(tmpDir);
          const result = await pinata.pinFromFS(tmpDir, { pinataOptions: { wrapWithDirectory: true } });
          await fs.rm(tmpDir, { recursive: true, force: true });
          // After successful Pinata upload
          if (!result || !result.IpfsHash) {
            console.error('Pinata upload did not return a valid IpfsHash:', result);
            return res.status(500).json({ error: 'Pinata upload failed: No IpfsHash returned', pinata: result });
          }
          // List all JSON files in the uploaded IPFS folder using the Pinata gateway
          const ipfsHash = result.IpfsHash;
          const folderUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}/${subfolder}/`;
          let metadataUris = [];
          try {
            // Fetch the folder listing (Pinata gateway returns HTML, so we must parse it)
            const folderRes = await fetch(folderUrl);
            const folderHtml = await folderRes.text();
            // Parse HTML to extract .json file links
            const jsonFiles = Array.from(folderHtml.matchAll(/href=["']([^"']+\.json)["']/g)).map(m => m[1]);
            // Build full URIs
            metadataUris = jsonFiles.map(f => `${folderUrl}${f}`);
          } catch (listErr) {
            console.error('Failed to list files in IPFS folder:', listErr);
            return res.status(500).json({ error: 'Failed to list files in IPFS folder', details: listErr.message || listErr });
          }
          if (!Array.isArray(metadataUris) || metadataUris.length === 0) {
            console.error('[POAP] metadataUris array is empty or invalid after folder listing:', metadataUris);
            return res.status(500).json({ error: 'metadataUris array is empty or invalid after folder listing' });
          }
          // Extract spaceId from fields (for frontend convenience)
          let spaceId = Array.isArray(fields.spaceId) ? fields.spaceId[0] : fields.spaceId;
          if (!spaceId && space) {
            spaceId = space;
          }
          // Return the CID, metadataPath, and metadataUris array (frontend will write to Firestore)
          const metadataPath = `${subfolder}/1.json`;
          return res.status(200).json({ ipfsHash, metadataPath, metadataUris, nftMetadataFolder: `${ipfsHash}/${subfolder}`, maxSupply: limit, spaceId });
        } catch (sdkErr) {
          if (tmpDir) {
            await fs.rm(tmpDir, { recursive: true, force: true });
          }
          console.error('Pinata upload failed:', sdkErr);
          return res.status(500).json({ error: 'Pinata upload failed', pinata: sdkErr.message || sdkErr });
        }
      } catch (e) {
        console.error('Error in form.parse callback:', e);
        return res.status(500).json({ error: 'Server error (form.parse)', details: e.message || e });
      }
    });
  } catch (e) {
    console.error('Top-level error:', e);
    res.status(500).json({ error: 'Server error', details: e.message || e });
  }
};

export default exportedHandler;
