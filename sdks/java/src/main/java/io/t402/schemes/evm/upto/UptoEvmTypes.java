package io.t402.schemes.evm.upto;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * EIP-712 type definitions and utilities for the Up-To EVM scheme.
 */
public final class UptoEvmTypes {

    private UptoEvmTypes() {}

    /** Scheme identifier for upto on EVM. */
    public static final String SCHEME = "upto";

    /**
     * TypedDataField represents a field in an EIP-712 type.
     */
    public static class TypedDataField {
        public final String name;
        public final String type;

        public TypedDataField(String name, String type) {
            this.name = name;
            this.type = type;
        }

        public Map<String, String> toMap() {
            Map<String, String> map = new HashMap<>();
            map.put("name", name);
            map.put("type", type);
            return map;
        }
    }

    /** EIP-712 type definition for Permit. */
    public static final List<TypedDataField> PERMIT_TYPE_FIELDS = List.of(
        new TypedDataField("owner", "address"),
        new TypedDataField("spender", "address"),
        new TypedDataField("value", "uint256"),
        new TypedDataField("nonce", "uint256"),
        new TypedDataField("deadline", "uint256")
    );

    /** EIP-712 domain type fields. */
    public static final List<TypedDataField> DOMAIN_TYPE_FIELDS = List.of(
        new TypedDataField("name", "string"),
        new TypedDataField("version", "string"),
        new TypedDataField("chainId", "uint256"),
        new TypedDataField("verifyingContract", "address")
    );

    /**
     * Gets the PERMIT_TYPES map for EIP-712 signing.
     *
     * @return map of type name to list of field definitions
     */
    public static Map<String, List<Map<String, String>>> getPermitTypes() {
        Map<String, List<Map<String, String>>> types = new HashMap<>();
        types.put("Permit", PERMIT_TYPE_FIELDS.stream()
            .map(TypedDataField::toMap)
            .toList());
        return types;
    }

    /**
     * Creates an EIP-712 domain for permit signing.
     *
     * @param name token name
     * @param version domain version
     * @param chainId chain ID
     * @param tokenAddress token contract address
     * @return map representing the EIP-712 domain
     */
    public static Map<String, Object> createPermitDomain(String name, String version,
            long chainId, String tokenAddress) {
        Map<String, Object> domain = new HashMap<>();
        domain.put("name", name);
        domain.put("version", version);
        domain.put("chainId", chainId);
        domain.put("verifyingContract", tokenAddress);
        return domain;
    }

    /**
     * Creates an EIP-712 message for permit signing.
     *
     * @param authorization permit authorization parameters
     * @return map representing the EIP-712 message
     */
    public static Map<String, Object> createPermitMessage(PermitAuthorization authorization) {
        Map<String, Object> message = new HashMap<>();
        message.put("owner", authorization.owner);
        message.put("spender", authorization.spender);
        message.put("value", new BigInteger(authorization.value));
        message.put("nonce", BigInteger.valueOf(authorization.nonce));
        message.put("deadline", new BigInteger(authorization.deadline));
        return message;
    }

    /**
     * Checks if the given data represents an EIP-2612 permit payload.
     *
     * @param data map containing payload data
     * @return true if the data is a valid EIP-2612 payload structure
     */
    @SuppressWarnings("unchecked")
    public static boolean isEIP2612Payload(Map<String, Object> data) {
        if (data == null) {
            return false;
        }

        Object sig = data.get("signature");
        Object auth = data.get("authorization");

        if (sig == null || auth == null) {
            return false;
        }

        // Check signature structure (should be object with v, r, s)
        if (!(sig instanceof Map)) {
            return false;
        }
        Map<String, Object> sigMap = (Map<String, Object>) sig;
        if (!sigMap.containsKey("v") || !sigMap.containsKey("r") || !sigMap.containsKey("s")) {
            return false;
        }

        // Check authorization structure
        if (!(auth instanceof Map)) {
            return false;
        }
        Map<String, Object> authMap = (Map<String, Object>) auth;
        return authMap.containsKey("owner") &&
               authMap.containsKey("spender") &&
               authMap.containsKey("value") &&
               authMap.containsKey("deadline");
    }
}
