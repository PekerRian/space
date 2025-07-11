// /api/upload-metadata.js

import fetch from 'node-fetch';
import formidable from 'formidable';
import pinataSDK from '@pinata/sdk';

// --- FIREBASE ADMIN SDK SETUP ---
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
if (!getApps().length) {
  // You must set GOOGLE_APPLICATION_CREDENTIALS env var or use serviceAccountKey.json
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {
    console.error('Failed to initialize Firebase Admin:', e);
  }
}
const firestore = admin.firestore();

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
          let usedFallback = false;
          try {
            // Fetch the folder listing (Pinata gateway returns HTML, so we must parse it)
            const folderRes = await fetch(folderUrl);
            const folderHtml = await folderRes.text();
            // Parse HTML to extract .json file links
            const jsonFiles = Array.from(folderHtml.matchAll(/href=["']([^"']+\.json)["']/g)).map(m => m[1]);
            // Filter: only include files that are direct children of the subfolder, match /^[0-9]+.json$/ and exclude any with '?' or 'collection.json' or 'uris.json' or '/ipfs/'
            const filteredFiles = jsonFiles.filter(f => /^[0-9]+\.json$/.test(f) && !f.includes('?') && f !== 'collection.json' && f !== 'uris.json' && !f.includes('/ipfs/'));
            // Build full URIs
            metadataUris = filteredFiles.map(f => `${folderUrl}${f}`);
            if (metadataUris.length === 0) throw new Error('No NFT JSONs found in folder listing');
            console.log(`[POAP] Successfully fetched ${metadataUris.length} NFT JSON files from IPFS folder:`, metadataUris);
          } catch (listErr) {
            // Fallback: construct URIs based on what we uploaded
            usedFallback = true;
            metadataUris = [];
            for (let i = 1; i <= limit; i++) {
              metadataUris.push(`${folderUrl}${i}.json`);
            }
            console.warn('[POAP] Fallback: constructed metadataUris array based on upload:', metadataUris);
          }
          if (!Array.isArray(metadataUris) || metadataUris.length === 0) {
            console.error('[POAP] metadataUris array is empty or invalid after folder listing and fallback:', metadataUris);
            return res.status(500).json({ error: 'metadataUris array is empty or invalid after folder listing and fallback' });
          }
          // Extract spaceId from fields (for frontend convenience)
          let spaceId = Array.isArray(fields.spaceId) ? fields.spaceId[0] : fields.spaceId;
          if (!spaceId && space) {
            spaceId = space;
          }
          const metadataPath = `${subfolder}/1.json`;

          // --- Write metadataUris to Firestore under spaces/{spaceId} ---
          let firestoreWriteError = null;
          if (spaceId && Array.isArray(metadataUris) && metadataUris.length > 0) {
            try {
              // Ensure the document exists (merge: true)
              await firestore.collection('spaces').doc(spaceId).set({ nftMetadataUris: metadataUris, nftMetadataFolder: `${ipfsHash}/${subfolder}` }, { merge: true });
              console.log(`[POAP][Backend] Successfully wrote nftMetadataUris to Firestore for spaceId ${spaceId}. Count: ${metadataUris.length}`);
            } catch (firestoreErr) {
              firestoreWriteError = firestoreErr;
              console.error(`[POAP][Backend] Failed to write nftMetadataUris to Firestore for spaceId ${spaceId}:`, firestoreErr);
            }
          } else {
            firestoreWriteError = 'Missing spaceId or metadataUris array.';
            console.error('[POAP][Backend] Missing spaceId or metadataUris array, not writing to Firestore.', { spaceId, metadataUris });
          }

          // Return the CID, metadataPath, and metadataUris array (frontend can still use as fallback)
          return res.status(200).json({
            ipfsHash,
            metadataPath,
            metadataUris,
            nftMetadataFolder: `${ipfsHash}/${subfolder}`,
            maxSupply: limit,
            spaceId,
            firestoreWriteError: firestoreWriteError ? (firestoreWriteError.message || String(firestoreWriteError)) : null
          });
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
