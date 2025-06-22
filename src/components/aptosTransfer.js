// Utility for APT transfer (from Flowers page)
export async function transferApt(signAndSubmitTransaction, account, toAddress, amount) {
  if (typeof signAndSubmitTransaction !== "function") {
    throw new Error("Wallet not connected or not compatible.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(toAddress)) {
    throw new Error("Recipient address is invalid. Must be a 0x-prefixed, 64-char hex Aptos address.");
  }
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new Error("Amount must be a positive number.");
  const octas = Math.floor(amt * 1e8);
  if (!Number.isInteger(octas) || octas <= 0) throw new Error("Amount must be at least 0.00000001 APT.");

  return await signAndSubmitTransaction({
    sender: account.address,
    data: {
      function: "0x1::coin::transfer",
      typeArguments: ["0x1::aptos_coin::AptosCoin"],
      functionArguments: [toAddress, octas],
    },
  });
}
