/**
 * Stacks Utility Functions
 */

import type { StacksTransactionResult, ParsedTokenTransfer } from "./types.js";

/**
 * Validate a Stacks principal address format
 * Stacks addresses start with SP (mainnet) or ST (testnet)
 * followed by alphanumeric characters (base58-like encoding)
 */
export function isValidPrincipal(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Standard principal: SP/ST prefix + base58 characters (33-41 chars total)
  // Contract principal: standard-principal.contract-name
  const parts = address.split(".");
  const principal = parts[0];

  // Check principal format: SP or ST prefix + alphanumeric (base58 chars)
  const principalRegex = /^(SP|ST)[0-9A-HJ-NP-Za-km-z]{33,41}$/;
  if (!principalRegex.test(principal)) {
    return false;
  }

  // If it's a contract principal, validate contract name
  if (parts.length === 2) {
    const contractName = parts[1];
    // Contract names: 1-128 chars, alphanumeric + hyphen + underscore
    const contractNameRegex = /^[a-zA-Z][a-zA-Z0-9\-_]{0,127}$/;
    return contractNameRegex.test(contractName);
  }

  // Standard principal (no contract part) or exactly one dot for contract
  return parts.length === 1;
}

/**
 * Validate a Stacks transaction ID format
 * Transaction IDs are 0x-prefixed 64-character hex strings
 */
export function isValidTxId(hash: string): boolean {
  if (!hash || typeof hash !== "string") {
    return false;
  }
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Compare two Stacks principals (case-sensitive)
 */
export function comparePrincipals(a: string, b: string): boolean {
  return a === b;
}

/**
 * Format an amount with decimals for display
 */
export function formatAmount(amount: string, decimals: number): string {
  const amountBigInt = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const wholePart = amountBigInt / divisor;
  const fractionalPart = amountBigInt % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");
  return `${wholePart}.${trimmedFractional}`;
}

/**
 * Parse an amount string to the smallest unit (with decimals applied)
 */
export function parseAmount(amount: string, decimals: number): string {
  const parts = amount.split(".");
  const wholePart = parts[0] || "0";
  const fractionalPart = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return BigInt(wholePart + fractionalPart).toString();
}

/**
 * Extract token transfer details from a Stacks transaction result
 * Looks for ft_transfer events matching the expected contract
 */
export function extractTokenTransfer(
  result: StacksTransactionResult,
  contractAddress?: string,
): ParsedTokenTransfer | null {
  if (result.txStatus !== "success") {
    return null;
  }

  // Check if this is a contract-call transaction
  if (result.txType !== "contract_call") {
    return null;
  }

  // Check contract call is a transfer function
  if (result.contractCall) {
    const { contractId, functionName } = result.contractCall;

    if (functionName !== "transfer") {
      return null;
    }

    // If contractAddress specified, verify it matches
    if (contractAddress && contractId !== contractAddress) {
      return null;
    }

    // Look for ft_transfer event
    const transferEvent = result.events.find(
      (e) => e.eventType === "fungible_token_asset" && e.asset?.assetEventType === "transfer",
    );

    if (transferEvent?.asset) {
      return {
        contractAddress: contractId,
        from: transferEvent.asset.sender,
        to: transferEvent.asset.recipient,
        amount: transferEvent.asset.amount,
        success: true,
      };
    }

    // Fallback: extract from function args if events not available
    if (result.contractCall.functionArgs.length >= 3) {
      const amountArg = result.contractCall.functionArgs[0];
      const senderArg = result.contractCall.functionArgs[1];
      const recipientArg = result.contractCall.functionArgs[2];

      // Parse principal from repr (format: 'SP...')
      const senderMatch = senderArg?.repr?.match(/^'?(S[PT][0-9A-HJ-NP-Za-km-z]+)/);
      const recipientMatch = recipientArg?.repr?.match(/^'?(S[PT][0-9A-HJ-NP-Za-km-z]+)/);
      const amountMatch = amountArg?.repr?.match(/^u(\d+)$/);

      if (senderMatch && recipientMatch && amountMatch) {
        return {
          contractAddress: contractId,
          from: senderMatch[1],
          to: recipientMatch[1],
          amount: amountMatch[1],
          success: true,
        };
      }
    }
  }

  return null;
}

/**
 * Extract token transfer from post conditions (alternative method)
 */
export function extractTokenTransferFromPostConditions(
  result: StacksTransactionResult,
  contractAddress?: string,
): ParsedTokenTransfer | null {
  if (result.txStatus !== "success") {
    return null;
  }

  // Look for fungible token post conditions
  for (const pc of result.postConditions) {
    if (pc.asset) {
      const assetContractAddress = `${pc.asset.contractAddress}.${pc.asset.contractName}`;

      if (contractAddress && assetContractAddress !== contractAddress) {
        continue;
      }

      // Find corresponding ft_transfer event for recipient
      const transferEvent = result.events.find(
        (e) =>
          e.eventType === "fungible_token_asset" &&
          e.asset?.assetEventType === "transfer" &&
          e.asset?.sender === pc.principal.address,
      );

      if (transferEvent?.asset) {
        return {
          contractAddress: assetContractAddress,
          from: transferEvent.asset.sender,
          to: transferEvent.asset.recipient,
          amount: transferEvent.asset.amount,
          success: true,
        };
      }
    }
  }

  return null;
}
