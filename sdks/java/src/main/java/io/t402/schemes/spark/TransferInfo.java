package io.t402.schemes.spark;

/**
 * Contains details of a Spark transfer.
 */
public class TransferInfo {

    private final String id;
    private final long amount; // satoshis
    private final String sender;
    private final String receiver;
    private final TransferStatus status;

    /**
     * Creates a new TransferInfo.
     *
     * @param id Transfer identifier
     * @param amount Transfer amount in satoshis
     * @param sender Sender's Spark address
     * @param receiver Receiver's Spark address
     * @param status Transfer status
     */
    public TransferInfo(String id, long amount, String sender, String receiver, TransferStatus status) {
        this.id = id;
        this.amount = amount;
        this.sender = sender;
        this.receiver = receiver;
        this.status = status;
    }

    /**
     * Gets the transfer identifier.
     *
     * @return Transfer ID
     */
    public String getId() {
        return id;
    }

    /**
     * Gets the transfer amount in satoshis.
     *
     * @return Amount in satoshis
     */
    public long getAmount() {
        return amount;
    }

    /**
     * Gets the sender's Spark address.
     *
     * @return Sender address
     */
    public String getSender() {
        return sender;
    }

    /**
     * Gets the receiver's Spark address.
     *
     * @return Receiver address
     */
    public String getReceiver() {
        return receiver;
    }

    /**
     * Gets the transfer status.
     *
     * @return Transfer status
     */
    public TransferStatus getStatus() {
        return status;
    }
}
