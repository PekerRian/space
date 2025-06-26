// aptosPoap.js - Utility for interacting with the on-chain POAP minter module
import { AptosClient, Types } from 'aptos';

const NODE_URL = 'https://fullnode.testnet.aptoslabs.com';
const MODULE_ADDR = '0x94f6da03f45fde2d18fd17d88671fc3d82fa4978329deee5012a41d1ad19a093';
const MODULE_NAME = 'launchpad';

const client = new AptosClient(NODE_URL);

// Calls the on-chain create_collection entry function
export function createCollection({ name, description, uri, max_supply = 10, start_time = 0, end_time = 1000, limit = 1, fee = 0 }) {
  const payload = {
    function: `${MODULE_ADDR}::${MODULE_NAME}::create_collection`,
    type_arguments: [],
    arguments: [
      name,         // name first
      description,  // then description
      uri,
      max_supply,
      [start_time], // Option<u64>
      [end_time],   // Option<u64>
      [limit],      // Option<u64>
      [fee]         // Option<u64>
    ],
    type: 'entry_function_payload',
  };
  console.log('About to return createCollection payload', payload);
  return payload;
}

// Calls the on-chain mint_nft entry function
export async function mintPoap({signAndSubmitTransaction, account, collectionObj}) {
  if (!signAndSubmitTransaction) throw new Error('Wallet not connected');
  const payload = {
    type: 'entry_function_payload',
    function: `${MODULE_ADDR}::${MODULE_NAME}::mint_nft`,
    type_arguments: [],
    arguments: [collectionObj],
  };
  console.log('About to call signAndSubmitTransaction for mintPoap', { payload, account });
  return signAndSubmitTransaction({ payload });
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
export function extractCollectionObjFromTx(txResult) {
  // For Aptos, the collection object address is usually in the events or changes
  // Try to find a resource or event with the collection object address
  if (!txResult) return null;
  // Check for events with collection object address
  if (txResult.events && Array.isArray(txResult.events)) {
    for (const event of txResult.events) {
      if (event.data && event.data.collection_object) {
        return event.data.collection_object;
      }
      // Sometimes the address is in event.data.object or similar
      if (event.data && event.data.object) {
        return event.data.object;
      }
    }
  }
  // Check for resource changes
  if (txResult.changes && Array.isArray(txResult.changes)) {
    for (const change of txResult.changes) {
      if (change.data && change.data.collection_object) {
        return change.data.collection_object;
      }
    }
  }
  // Fallback: check for any address-like string in the result
  const str = JSON.stringify(txResult);
  const match = str.match(/0x[a-fA-F0-9]{32,}/);
  return match ? match[0] : null;
}
