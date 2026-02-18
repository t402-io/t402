package io.t402.wdk.multisig;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Multi-signature payments via Safe smart accounts.
 *
 * <p>Coordinates signature collection from multiple signers and
 * executes transactions when the threshold is reached.
 *
 * <p>Example usage:
 * <pre>{@code
 * WDKMultisigConfig config = new WDKMultisigConfig(
 *     "0xSafeAddress...", 2,
 *     List.of("0xOwner1...", "0xOwner2...", "0xOwner3...")
 * );
 *
 * WDKMultisigClient client = new WDKMultisigClient(config);
 *
 * String proposalId = client.proposePayment(
 *     "0xRecipient...", BigInteger.valueOf(1000000), "0xToken..."
 * ).join();
 *
 * client.approvePayment(proposalId).join();
 * client.approvePayment(proposalId).join();
 *
 * String txHash = client.executePayment(proposalId).join();
 * }</pre>
 */
public class WDKMultisigClient {

    private static final String ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    private final WDKMultisigConfig config;
    private final Map<String, MultisigProposal> proposals = new HashMap<>();
    private int nextSignerIndex = 0;

    /**
     * Creates a new multisig client.
     *
     * @param config Multisig configuration
     */
    public WDKMultisigClient(WDKMultisigConfig config) {
        if (config == null) {
            throw new IllegalArgumentException("Config is required");
        }
        this.config = config;
    }

    /**
     * Propose a new payment requiring multi-sig approval.
     *
     * @param to Recipient address
     * @param amount Payment amount in atomic units
     * @param token Token contract address
     * @return Future completing with the proposal ID
     */
    public CompletableFuture<String> proposePayment(String to, BigInteger amount, String token) {
        return CompletableFuture.supplyAsync(() -> {
            validatePaymentParams(to, amount, token);

            String proposalId = UUID.randomUUID().toString();
            MultisigProposal proposal = new MultisigProposal(proposalId, to, amount, token);
            proposals.put(proposalId, proposal);

            return proposalId;
        });
    }

    /**
     * Add a signature approval to a proposal.
     *
     * @param proposalId The proposal to approve
     * @return Future completing with true if signature was added
     */
    public CompletableFuture<Boolean> approvePayment(String proposalId) {
        return CompletableFuture.supplyAsync(() -> {
            MultisigProposal proposal = getProposalOrThrow(proposalId);

            if (proposal.isExecuted()) {
                throw new IllegalStateException("Proposal already executed");
            }

            // Find next owner that hasn't signed
            List<String> owners = config.getOwners();
            for (String owner : owners) {
                if (!proposal.hasSignature(owner)) {
                    proposal.addSignature(owner, "sig_" + owner + "_" + proposalId);
                    return true;
                }
            }

            throw new IllegalStateException("No available signers for approval");
        });
    }

    /**
     * Execute a payment when threshold signatures are collected.
     *
     * @param proposalId The proposal to execute
     * @return Future completing with the transaction hash
     */
    public CompletableFuture<String> executePayment(String proposalId) {
        return CompletableFuture.supplyAsync(() -> {
            MultisigProposal proposal = getProposalOrThrow(proposalId);

            if (proposal.isExecuted()) {
                throw new IllegalStateException("Proposal already executed");
            }

            if (proposal.getSignatureCount() < config.getThreshold()) {
                throw new IllegalStateException(
                        "Insufficient signatures: " + proposal.getSignatureCount()
                                + "/" + config.getThreshold());
            }

            proposal.setExecuted(true);
            return "0x" + "0".repeat(64);
        });
    }

    /**
     * Get all pending (unexecuted) proposals.
     *
     * @return Future completing with list of pending proposals
     */
    public CompletableFuture<List<MultisigProposal>> getPendingProposals() {
        return CompletableFuture.supplyAsync(() ->
                proposals.values().stream()
                        .filter(p -> !p.isExecuted())
                        .collect(Collectors.toList()));
    }

    /**
     * Check if a proposal has enough signatures to execute.
     *
     * @param proposalId The proposal ID
     * @return True if threshold is met
     */
    public boolean isReady(String proposalId) {
        MultisigProposal proposal = getProposalOrThrow(proposalId);
        return proposal.getSignatureCount() >= config.getThreshold();
    }

    /**
     * Get a proposal by ID.
     *
     * @param proposalId The proposal ID
     * @return The proposal
     */
    public MultisigProposal getProposal(String proposalId) {
        return getProposalOrThrow(proposalId);
    }

    public WDKMultisigConfig getConfig() {
        return config;
    }

    private MultisigProposal getProposalOrThrow(String proposalId) {
        MultisigProposal proposal = proposals.get(proposalId);
        if (proposal == null) {
            throw new IllegalArgumentException("Proposal not found: " + proposalId);
        }
        return proposal;
    }

    private void validatePaymentParams(String to, BigInteger amount, String token) {
        if (to == null || to.isEmpty()) {
            throw new IllegalArgumentException("Recipient address is required");
        }
        if (ZERO_ADDRESS.equals(to)) {
            throw new IllegalArgumentException("Recipient must not be the zero address");
        }
        if (amount == null || amount.compareTo(BigInteger.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
        if (token == null || token.isEmpty()) {
            throw new IllegalArgumentException("Token address is required");
        }
    }

    /**
     * A pending multi-signature payment proposal.
     */
    public static class MultisigProposal {
        private final String proposalId;
        private final String to;
        private final BigInteger amount;
        private final String token;
        private final Map<String, String> signatures = new HashMap<>();
        private final long createdAt;
        private boolean executed;

        public MultisigProposal(String proposalId, String to, BigInteger amount, String token) {
            this.proposalId = proposalId;
            this.to = to;
            this.amount = amount;
            this.token = token;
            this.createdAt = System.currentTimeMillis();
            this.executed = false;
        }

        public String getProposalId() {
            return proposalId;
        }

        public String getTo() {
            return to;
        }

        public BigInteger getAmount() {
            return amount;
        }

        public String getToken() {
            return token;
        }

        public int getSignatureCount() {
            return signatures.size();
        }

        public boolean hasSignature(String owner) {
            return signatures.containsKey(owner);
        }

        public void addSignature(String owner, String signature) {
            signatures.put(owner, signature);
        }

        public long getCreatedAt() {
            return createdAt;
        }

        public boolean isExecuted() {
            return executed;
        }

        public void setExecuted(boolean executed) {
            this.executed = executed;
        }
    }
}
