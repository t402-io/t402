package io.t402.schemes.evm.erc7710;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for ERC-7710 delegation-based payments.
 *
 * <p>Contains the delegation manager address, opaque permission context,
 * and the delegator (smart account) address.</p>
 */
public class ERC7710Payload {

    private final String delegationManager;
    private final String permissionContext;
    private final String delegator;

    /**
     * Creates a new ERC7710Payload.
     *
     * @param delegationManager Address of the DelegationManager contract
     * @param permissionContext Opaque permission context bytes (hex-encoded)
     * @param delegator Address of the delegator (smart account)
     */
    public ERC7710Payload(String delegationManager, String permissionContext, String delegator) {
        this.delegationManager = delegationManager;
        this.permissionContext = permissionContext;
        this.delegator = delegator;
    }

    /**
     * Gets the DelegationManager contract address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getDelegationManager() {
        return delegationManager;
    }

    /**
     * Gets the opaque permission context.
     *
     * @return 0x-prefixed hex-encoded bytes
     */
    public String getPermissionContext() {
        return permissionContext;
    }

    /**
     * Gets the delegator (smart account) address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getDelegator() {
        return delegator;
    }

    /**
     * Converts the payload to a map.
     *
     * @return Map representation of the payload
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("delegationManager", delegationManager);
        map.put("permissionContext", permissionContext);
        map.put("delegator", delegator);
        return map;
    }

    /**
     * Creates an ERC7710Payload from a map.
     *
     * @param map Map containing payload data
     * @return New ERC7710Payload instance
     * @throws IllegalArgumentException if required fields are missing
     */
    public static ERC7710Payload fromMap(Map<String, Object> map) {
        String delegationManager = (String) map.get("delegationManager");
        String permissionContext = (String) map.get("permissionContext");
        String delegator = (String) map.get("delegator");

        if (delegationManager == null || delegationManager.isEmpty()) {
            throw new IllegalArgumentException("Missing delegationManager in payload");
        }
        if (permissionContext == null || permissionContext.isEmpty()) {
            throw new IllegalArgumentException("Missing permissionContext in payload");
        }
        if (delegator == null || delegator.isEmpty()) {
            throw new IllegalArgumentException("Missing delegator in payload");
        }

        return new ERC7710Payload(delegationManager, permissionContext, delegator);
    }
}
