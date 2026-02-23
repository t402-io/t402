package io.t402.schemes.evm.permit2proxy;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side Permit2 Proxy EIP-712 signing operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's Ethereum address</li>
 *   <li>Sign Permit2 PermitWitnessTransferFrom messages using EIP-712</li>
 * </ul>
 */
public interface Permit2ProxySigner {

    /**
     * Gets the signer's Ethereum address.
     *
     * @return 0x-prefixed Ethereum address
     */
    String getAddress();

    /**
     * Signs Permit2 PermitWitnessTransferFrom EIP-712 typed data.
     *
     * <p>The domain will contain Permit2 contract domain parameters.
     * The message will contain PermitWitnessTransferFrom fields including witness data.</p>
     *
     * @param domain EIP-712 domain parameters
     * @param message PermitWitnessTransferFrom message to sign
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing 0x-prefixed hex-encoded signature (65 bytes)
     */
    CompletableFuture<String> signPermitWitnessTransferFrom(
            Map<String, Object> domain,
            Map<String, Object> message,
            String network);

    default String signPermitWitnessTransferFromSync(
            Map<String, Object> domain,
            Map<String, Object> message,
            String network) {
        return signPermitWitnessTransferFrom(domain, message, network).join();
    }
}
