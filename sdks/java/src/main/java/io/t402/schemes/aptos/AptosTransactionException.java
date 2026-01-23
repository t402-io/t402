package io.t402.schemes.aptos;

/**
 * Exception thrown when an Aptos transaction operation fails.
 *
 * <p>This exception is used to indicate various failure modes during
 * Aptos payment processing:
 * <ul>
 *   <li>Transaction not found on-chain</li>
 *   <li>Transaction failed (vm_status error)</li>
 *   <li>Transaction submission failures</li>
 *   <li>RPC/network errors</li>
 *   <li>Invalid transaction format</li>
 * </ul>
 */
public class AptosTransactionException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String txHash;
    private final String vmStatus;

    /**
     * Creates a new AptosTransactionException with a message.
     *
     * @param message Error message
     */
    public AptosTransactionException(String message) {
        super(message);
        this.txHash = null;
        this.vmStatus = null;
    }

    /**
     * Creates a new AptosTransactionException with a message and cause.
     *
     * @param message Error message
     * @param cause Underlying cause
     */
    public AptosTransactionException(String message, Throwable cause) {
        super(message, cause);
        this.txHash = null;
        this.vmStatus = null;
    }

    /**
     * Creates a new AptosTransactionException with transaction details.
     *
     * @param message Error message
     * @param txHash Transaction hash if available
     * @param vmStatus Aptos VM status if available
     */
    public AptosTransactionException(String message, String txHash, String vmStatus) {
        super(message);
        this.txHash = txHash;
        this.vmStatus = vmStatus;
    }

    /**
     * Gets the transaction hash if available.
     *
     * @return Transaction hash or null
     */
    public String getTxHash() {
        return txHash;
    }

    /**
     * Gets the VM status if available.
     *
     * @return Aptos VM status string or null
     */
    public String getVmStatus() {
        return vmStatus;
    }
}
