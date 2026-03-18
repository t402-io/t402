package io.t402.extensions.offerreceipt;

import java.util.List;
import java.util.Map;

/**
 * Constants for the Offer and Receipt extension.
 * EIP-712 domain and type definitions.
 */
public final class OfferReceiptConstants {

    private OfferReceiptConstants() {}

    public static final String EXTENSION_KEY = "offer-receipt";

    // EIP-712 domain (chainId=1 for off-chain signing)
    public static final String OFFER_DOMAIN_NAME = "t402 offer";
    public static final String RECEIPT_DOMAIN_NAME = "t402 receipt";
    public static final String DOMAIN_VERSION = "1";
    public static final long DOMAIN_CHAIN_ID = 1L;

    public static Map<String, Object> offerDomain() {
        return Map.of("name", OFFER_DOMAIN_NAME, "version", DOMAIN_VERSION, "chainId", DOMAIN_CHAIN_ID);
    }

    public static Map<String, Object> receiptDomain() {
        return Map.of("name", RECEIPT_DOMAIN_NAME, "version", DOMAIN_VERSION, "chainId", DOMAIN_CHAIN_ID);
    }

    public static List<Map<String, String>> offerTypes() {
        return List.of(
            Map.of("name", "version", "type", "uint256"),
            Map.of("name", "resourceUrl", "type", "string"),
            Map.of("name", "scheme", "type", "string"),
            Map.of("name", "network", "type", "string"),
            Map.of("name", "asset", "type", "string"),
            Map.of("name", "payTo", "type", "string"),
            Map.of("name", "amount", "type", "string"),
            Map.of("name", "validUntil", "type", "uint256")
        );
    }

    public static List<Map<String, String>> receiptTypes() {
        return List.of(
            Map.of("name", "version", "type", "uint256"),
            Map.of("name", "network", "type", "string"),
            Map.of("name", "resourceUrl", "type", "string"),
            Map.of("name", "payer", "type", "string"),
            Map.of("name", "issuedAt", "type", "uint256"),
            Map.of("name", "transaction", "type", "string")
        );
    }
}
