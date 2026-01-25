package io.t402.multisig;

import io.t402.multisig.SafeTypes.SafeSignature;
import io.t402.multisig.SafeTypes.SafeTransaction;
import io.t402.multisig.SafeTypes.TransactionRequest;

import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages pending multi-sig transactions and signature collection.
 */
public class SignatureCollector {

    private final Map<String, TransactionRequest> pendingRequests = new ConcurrentHashMap<>();
    private final int expirationSeconds;
    private final SecureRandom random = new SecureRandom();

    /**
     * Create a SignatureCollector with default expiration (1 hour).
     */
    public SignatureCollector() {
        this(SafeConstants.DEFAULT_REQUEST_EXPIRATION_SECONDS);
    }

    /**
     * Create a SignatureCollector with custom expiration.
     *
     * @param expirationSeconds Request expiration time in seconds
     */
    public SignatureCollector(int expirationSeconds) {
        this.expirationSeconds = expirationSeconds;
    }

    /**
     * Create a new signature collection request.
     *
     * @param safeAddress Address of the Safe
     * @param tx          The Safe transaction
     * @param txHash      Transaction hash for signing
     * @param owners      List of owner addresses
     * @param threshold   Number of signatures required
     * @return New TransactionRequest
     */
    public TransactionRequest createRequest(
            String safeAddress,
            SafeTransaction tx,
            String txHash,
            List<String> owners,
            int threshold) {
        long now = System.currentTimeMillis() / 1000;
        String id = generateRequestId();

        TransactionRequest request = new TransactionRequest(
                id,
                safeAddress,
                tx,
                txHash,
                threshold,
                now,
                now + expirationSeconds
        );

        pendingRequests.put(id, request);
        return request;
    }

    /**
     * Add a signature to a request.
     *
     * @param requestId Request ID
     * @param signature Signature to add
     * @throws IllegalArgumentException If request not found, expired, or already signed
     */
    public void addSignature(String requestId, SafeSignature signature) {
        TransactionRequest request = pendingRequests.get(requestId);
        if (request == null) {
            throw new IllegalArgumentException("Request not found");
        }

        // Check expiration
        if (System.currentTimeMillis() / 1000 > request.getExpiresAt()) {
            pendingRequests.remove(requestId);
            throw new IllegalArgumentException("Request expired");
        }

        // Check if already signed by this signer
        String signerLower = signature.getSigner().toLowerCase();
        if (request.getSignatures().containsKey(signerLower)) {
            throw new IllegalArgumentException("Already signed by this signer");
        }

        request.addSignature(signature);
    }

    /**
     * Get a pending request.
     *
     * @param requestId Request ID
     * @return TransactionRequest or null if not found/expired
     */
    public TransactionRequest getRequest(String requestId) {
        TransactionRequest request = pendingRequests.get(requestId);
        if (request == null) {
            return null;
        }

        // Check expiration
        if (System.currentTimeMillis() / 1000 > request.getExpiresAt()) {
            pendingRequests.remove(requestId);
            return null;
        }

        return request;
    }

    /**
     * Remove a request.
     *
     * @param requestId Request ID
     * @return true if removed, false if not found
     */
    public boolean removeRequest(String requestId) {
        return pendingRequests.remove(requestId) != null;
    }

    /**
     * Get all non-expired pending requests.
     */
    public List<TransactionRequest> getPendingRequests() {
        cleanup();
        return new ArrayList<>(pendingRequests.values());
    }

    /**
     * Get owners who haven't signed a request yet.
     *
     * @param requestId Request ID
     * @param owners    List of all owner addresses
     * @return List of pending owner addresses
     */
    public List<String> getPendingOwners(String requestId, List<String> owners) {
        TransactionRequest request = pendingRequests.get(requestId);
        if (request == null) {
            return Collections.emptyList();
        }

        List<String> pending = new ArrayList<>();
        for (String owner : owners) {
            if (!request.getSignatures().containsKey(owner.toLowerCase())) {
                pending.add(owner);
            }
        }
        return pending;
    }

    /**
     * Get owners who have signed a request.
     *
     * @param requestId Request ID
     * @return List of signed owner addresses
     */
    public List<String> getSignedOwners(String requestId) {
        TransactionRequest request = pendingRequests.get(requestId);
        if (request == null) {
            return Collections.emptyList();
        }

        return new ArrayList<>(request.getSignatures().keySet());
    }

    /**
     * Get the combined signature for execution.
     *
     * @param requestId Request ID
     * @return Combined signature bytes
     * @throws IllegalArgumentException If request not found or not ready
     */
    public byte[] getCombinedSignature(String requestId) {
        TransactionRequest request = pendingRequests.get(requestId);
        if (request == null) {
            throw new IllegalArgumentException("Request not found");
        }

        if (!request.isReady()) {
            throw new IllegalArgumentException("Not enough signatures");
        }

        return combineSignatures(request.getSignatures());
    }

    /**
     * Remove expired requests.
     */
    public void cleanup() {
        long now = System.currentTimeMillis() / 1000;
        pendingRequests.entrySet().removeIf(entry ->
                now > entry.getValue().getExpiresAt());
    }

    /**
     * Remove all pending requests.
     */
    public void clear() {
        pendingRequests.clear();
    }

    /**
     * Generate a unique request ID.
     */
    private String generateRequestId() {
        long timestamp = System.currentTimeMillis();
        byte[] randomBytes = new byte[4];
        random.nextBytes(randomBytes);
        return String.format("msig_%x_%s",
                timestamp,
                bytesToHex(randomBytes));
    }

    /**
     * Combine signatures sorted by signer address.
     */
    public static byte[] combineSignatures(Map<String, SafeSignature> signatures) {
        // Sort signers by address
        List<String> sortedSigners = new ArrayList<>(signatures.keySet());
        Collections.sort(sortedSigners, String.CASE_INSENSITIVE_ORDER);

        // Pack signatures
        ByteArrayOutputStream packed = new ByteArrayOutputStream();
        for (String signer : sortedSigners) {
            SafeSignature sig = signatures.get(signer);
            byte[] sigBytes = sig.getSignature();
            packed.write(sigBytes, 0, sigBytes.length);
        }

        return packed.toByteArray();
    }

    /**
     * Check if a threshold is valid for the given owner count.
     */
    public static boolean isValidThreshold(int threshold, int ownerCount) {
        return threshold >= SafeConstants.MIN_THRESHOLD && threshold <= ownerCount;
    }

    /**
     * Check if all addresses are unique (case-insensitive).
     */
    public static boolean areAddressesUnique(List<String> addresses) {
        List<String> lowerAddresses = new ArrayList<>();
        for (String addr : addresses) {
            lowerAddresses.add(addr.toLowerCase());
        }
        return lowerAddresses.size() == new java.util.HashSet<>(lowerAddresses).size();
    }

    /**
     * Get the index of an owner in the list.
     *
     * @return Index or -1 if not found
     */
    public static int getOwnerIndex(String owner, List<String> owners) {
        String ownerLower = owner.toLowerCase();
        for (int i = 0; i < owners.size(); i++) {
            if (owners.get(i).toLowerCase().equals(ownerLower)) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Sort addresses in ascending order (case-insensitive).
     */
    public static List<String> sortAddresses(List<String> addresses) {
        List<String> sorted = new ArrayList<>(addresses);
        Collections.sort(sorted, String.CASE_INSENSITIVE_ORDER);
        return sorted;
    }

    /**
     * Convert byte array to hex string.
     */
    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
