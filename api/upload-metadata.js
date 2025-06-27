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
        // Build array of metadata URIs
        const metadataUris = [];
        for (let i = 1; i <= limit; i++) {
          metadataUris.push(`https://gateway.pinata.cloud/ipfs/${result.IpfsHash}/${subfolder}/${i}.json`);
        }
        // Extract spaceId from fields
        let spaceId = Array.isArray(fields.spaceId) ? fields.spaceId[0] : fields.spaceId;
        // Fallback: try to use 'space' as spaceId if spaceId is missing (legacy support)
        if (!spaceId && space) {
          spaceId = space;
          console.warn('[POAP] No spaceId provided, falling back to space name as spaceId:', spaceId);
        }
        // Save to Firestore if spaceId is provided
        if (spaceId) {
          try {
            console.log('[POAP] Writing to Firestore:', { spaceId, nftMetadataUris: metadataUris, nftMetadataFolder: `${result.IpfsHash}/${subfolder}` });
            const { getFirestore, doc, setDoc, updateDoc, getDoc } = await import('firebase-admin/firestore');
            const db = getFirestore();
            // If the document does not exist, create it (setDoc), else update it
            const spaceDocRef = doc(db, 'spaces', spaceId);
            const spaceDocSnap = await getDoc(spaceDocRef);
            if (!spaceDocSnap.exists) {
              await setDoc(spaceDocRef, {
                nftMetadataUris: metadataUris,
                nftMetadataFolder: `${result.IpfsHash}/${subfolder}`
              }, { merge: true });
              console.log('[POAP] Firestore document created for spaceId:', spaceId);
            } else {
              await updateDoc(spaceDocRef, {
                nftMetadataUris: metadataUris,
                nftMetadataFolder: `${result.IpfsHash}/${subfolder}`
              });
              console.log('[POAP] Firestore update successful for spaceId:', spaceId);
            }
          } catch (firestoreErr) {
            console.error('Failed to update Firestore with metadataUris:', firestoreErr);
          }
        } else {
          console.error('[POAP] No spaceId provided, cannot write nftMetadataUris to Firestore.');
        }
        // Return the CID, metadataPath, and metadataUris array
        const metadataPath = `${subfolder}/1.json`;
        return res.status(200).json({ ipfsHash: result.IpfsHash, metadataPath, metadataUris });
      } catch (sdkErr) {
        if (tmpDir) {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
        console.error('Pinata upload failed:', sdkErr);
        return res.status(500).json({ error: 'Pinata upload failed', pinata: sdkErr.message || sdkErr });
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
