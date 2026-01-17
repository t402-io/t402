import { bench, describe } from "vitest";
import {
  getTokenConfig,
  getNetworkTokens,
  getDefaultToken,
  getTokenByAddress,
  supportsEIP3009,
  getNetworksForToken,
  getUsdt0Networks,
  getEIP712Domain,
  USDT0_ADDRESSES,
} from "../tokens";

describe("Token Configuration Lookup", () => {
  bench("getTokenConfig - USDT0 on Ethereum", () => {
    getTokenConfig("eip155:1", "USDT0");
  });

  bench("getTokenConfig - USDT0 on Arbitrum", () => {
    getTokenConfig("eip155:42161", "USDT0");
  });

  bench("getNetworkTokens - Ethereum", () => {
    getNetworkTokens("eip155:1");
  });

  bench("getNetworkTokens - Arbitrum", () => {
    getNetworkTokens("eip155:42161");
  });

  bench("getDefaultToken - Ethereum", () => {
    getDefaultToken("eip155:1");
  });
});

describe("Token Address Lookup", () => {
  bench("getTokenByAddress - USDT0 Ethereum", () => {
    getTokenByAddress("eip155:1", USDT0_ADDRESSES["eip155:1"]!);
  });

  bench("getTokenByAddress - invalid address", () => {
    getTokenByAddress("eip155:1", "0x0000000000000000000000000000000000000000");
  });
});

describe("EIP-3009 Support Check", () => {
  bench("supportsEIP3009 - USDT0", () => {
    supportsEIP3009("eip155:1", "USDT0");
  });

  bench("supportsEIP3009 - USDT_LEGACY", () => {
    supportsEIP3009("eip155:1", "USDT_LEGACY");
  });
});

describe("Network Discovery", () => {
  bench("getNetworksForToken - USDT0", () => {
    getNetworksForToken("USDT0");
  });

  bench("getUsdt0Networks", () => {
    getUsdt0Networks();
  });
});

describe("EIP-712 Domain", () => {
  bench("getEIP712Domain - USDT0 on Ethereum", () => {
    getEIP712Domain("eip155:1", "USDT0");
  });

  bench("getEIP712Domain - USDT0 on Arbitrum", () => {
    getEIP712Domain("eip155:42161", "USDT0");
  });
});
