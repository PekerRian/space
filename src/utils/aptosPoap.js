// aptosPoap.js - Utility for interacting with the on-chain POAP minter module
import { AptosClient, Types } from 'aptos';

const NODE_URL = 'https://fullnode.testnet.aptoslabs.com';
const MODULE_ADDR = '0x170518deafae63b378f1deb898d69e2e22b1d5e40b50a45f85ceaf1175de2e2d';
const MODULE_NAME = 'poap_launchpad';

const client = new AptosClient(NODE_URL);

// Calls the on-chain create_collection entry function
export function createCollection({ name, description, uri, max_supply = 10, start_time, end_time, limit = 1, fee = 0, account }) {
  if (!account || !account.address) {
    throw new Error('Account is missing or invalid in createCollection');
  }
  // Set default start_time to now if not provided, end_time to 24h later
  const now = Math.floor(Date.now() / 1000);
  const start = typeof start_time === 'number' && start_time > 0 ? start_time : now;
  const end = typeof end_time === 'number' && end_time > start ? end_time : now + 24 * 60 * 60;
  // Defensive: log and check max_supply type
  console.log('createCollection: max_supply type:', typeof max_supply, 'value:', max_supply);
  if (typeof max_supply !== 'number' && typeof max_supply !== 'bigint' && typeof max_supply !== 'string') {
    throw new Error('max_supply must be a number, bigint, or string');
  }
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
  console.log('About to return createCollection data', data);
  return {
    sender: typeof account.address === 'string' ? account.address : account.address.toString(),
    data
  };
}

// Calls the on-chain mint_nft entry function
export async function mintPoap({signAndSubmitTransaction, account, collectionObj}) {
  if (!signAndSubmitTransaction) throw new Error('Wallet not connected');
  const data = {
    function: `${MODULE_ADDR}::${MODULE_NAME}::mint_nft`,
    typeArguments: [],
    functionArguments: [collectionObj],
  };
  console.log('About to call signAndSubmitTransaction for mintPoap', { data, account, collectionObj });
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
