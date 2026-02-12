package io.t402.client;

/** JSON returned by POST /settle on the facilitator. */
public class SettlementResponse {
    /** Whether the payment settlement succeeded. */
    public boolean success;

    /** Error reason if settlement failed. */
    public String  errorReason;

    /** Payer address. */
    public String  payer;

    /** Transaction hash of the settled payment. */
    public String  transaction;

    /** Network where the settlement occurred (CAIP-2). */
    public String  network;

    /** Confirmation status (e.g., "pending"). */
    public String  confirmations;
}
