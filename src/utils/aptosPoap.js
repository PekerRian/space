// aptosPoap.js - Utility for interacting with the on-chain POAP minter module
import { AptosClient, Types } from 'aptos';

const NODE_URL = 'https://fullnode.testnet.aptoslabs.com';
const MODULE_ADDR = '0x94f6da03f45fde2d18fd17d88671fc3d82fa4978329deee5012a41d1ad19a093';
const MODULE_NAME = 'launchpad';

const client = new AptosClient(NODE_URL);

// Calls the on-chain create_collection entry function
export async function createCollection({signAndSubmitTransaction, account, name, description, uri, max_supply = 10, start_time = 0, end_time = 1000, limit = 1, fee = 0}) {
  if (!signAndSubmitTransaction) throw new Error('Wallet not connected');
  const payload = {
    function: `${MODULE_ADDR}::${MODULE_NAME}::create_collection`,
    type_arguments: [],
    arguments: [
      description,
      name,
      uri,
      max_supply,
      [start_time], // Option<u64>
      [end_time],   // Option<u64>
      [limit],      // Option<u64>
      [fee]         // Option<u64>
    ],
    type: 'entry_function_payload',
  };
  return signAndSubmitTransaction({ payload });
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
