// aptosPoap.js - Utility for interacting with the on-chain POAP minter module
import { AptosClient, Types } from 'aptos';

const NODE_URL = 'https://fullnode.testnet.aptoslabs.com';
const MODULE_ADDR = '0x19619ad8c1ff22b0d9a34d605546c1cb42d7a627da27ff10c86e7c6a8da2f09f';
const MODULE_NAME = 'poap_launchpad';

const client = new AptosClient(NODE_URL);

// Calls the on-chain create_collection entry function
export function createCollection({ name, description, uri, max_supply = 10, limit = 1, fee = 0, account }) {
  if (!account || !account.address) {
    throw new Error('Account is missing or invalid in createCollection');
  }
  // Always set minting window: start = now - 10, end = now + 1 year (in seconds)
  const now = Math.floor(Date.now() / 1000);
  const start = now - 10;
  const end = now + 365 * 24 * 60 * 60;
  const data = {
    function: `${MODULE_ADDR}::${MODULE_NAME}::create_collection`,
    typeArguments: [],
    functionArguments: [
      name,
      description,
      uri,
      max_supply,
      start,
      end,
      limit,
      fee
    ]
  };
  return {
    sender: typeof account.address === 'string' ? account.address : account.address.toString(),
    data
  };
}

// Calls the on-chain mint_nft entry function
export async function mintPoap({signAndSubmitTransaction, account, collectionObj, metadataUri}) {
  if (!signAndSubmitTransaction) throw new Error('Wallet not connected');
  if (!collectionObj) throw new Error('Collection object address is required');
  if (!metadataUri) throw new Error('metadataUri is required for minting');
  const data = {
    function: `${MODULE_ADDR}::${MODULE_NAME}::mint_nft`,
    typeArguments: [],
    functionArguments: [collectionObj, metadataUri],
  };
  return signAndSubmitTransaction({ sender: account.address, data });
}

// Reads the registry (view function)
export async function getRegistry() {
  const payload = {
    function: `${MODULE_ADDR}::${MODULE_NAME}::get_registry`,
    type_arguments: [],
    arguments: [],
  };
  return client.view(payload);
}

// Returns the collection object address from the transaction result
export async function extractCollectionObjFromTx(txResult, txHash) {
  // If events are present, use the current logic
  if (txResult && txResult.events && Array.isArray(txResult.events)) {
    const event = txResult.events[2];
    if (
      event &&
      event.type &&
      event.type.endsWith('::poap_launchpad::CollectionCreatedEvent') &&
      event.data &&
      event.data.collection_obj_addr
    ) {
      return event.data.collection_obj_addr;
    }
    for (const event of txResult.events) {
      if (event.data && event.data.collection_obj_addr) {
        return event.data.collection_obj_addr;
      }
      if (event.data && event.data.collection_object) {
        return event.data.collection_object;
      }
      if (event.data && event.data.object) {
        return event.data.object;
      }
    }
  }
  // If events are missing, try fetching the transaction details from the Aptos node
  if (txHash) {
    try {
      const txDetails = await client.getTransactionByHash(txHash);
      if (txDetails && txDetails.events && Array.isArray(txDetails.events)) {
        for (const event of txDetails.events) {
          if (event.data && event.data.collection_obj_addr) {
            return event.data.collection_obj_addr;
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch transaction details from Aptos node:', e);
    }
  }
  // Check for resource changes
  if (txResult && txResult.changes && Array.isArray(txResult.changes)) {
    for (const change of txResult.changes) {
      if (change.data && change.data.collection_obj_addr) {
        return change.data.collection_obj_addr;
      }
      if (change.data && change.data.collection_object) {
        return change.data.collection_object;
      }
    }
  }
  return null;
}

// Utility to check if a collection object exists on-chain
export async function collectionExists(collectionObj) {
  if (!collectionObj) return false;
  try {
    // Try to fetch the resource at the collectionObj address
    const resource = await client.getAccountResources(collectionObj);
    // If resources are returned, the object exists
    return Array.isArray(resource) && resource.length > 0;
  } catch (e) {
    // If the object does not exist, Aptos will throw an error
    return false;
  }
}

// Fetch all resources at the collection object address
export async function getCollectionResources(collectionObjAddr) {
  if (!collectionObjAddr) return null;
  try {
    const resources = await client.getAccountResources(collectionObjAddr);
    return resources;
  } catch (e) {
    console.error('Failed to fetch collection resources:', e);
    return null;
  }
}
