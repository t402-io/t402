package io.t402.client;

import io.t402.crypto.CryptoSigner;
import io.t402.crypto.CryptoSignException;
import io.t402.model.PaymentPayload;

import java.io.IOException;
import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Convenience wrapper that builds an HTTP request with a properly-formed
 * X-PAYMENT header for the “exact” EVM scheme on Base Sepolia.
 *
 * You provide a {@link CryptoSigner} implementation to actually sign the
 * payment payload (e.g. using web3j). Everything else is generic JSON + Base64.
 */
public class T402HttpClient {

    private final HttpClient http = HttpClient.newHttpClient();
    private final int    t402Version = 1;
    private final String scheme      = "exact";
    private final String network     = "base-sepolia";

    private final CryptoSigner signer;

    /**
     * Creates a new T402 HTTP client with the specified crypto signer.
     *
     * @param signer the crypto signer for signing payment headers
     */
    public T402HttpClient(CryptoSigner signer) {
        this.signer = signer;
    }

    /**
     * Protected method that can be overridden in tests to mock HTTP responses.
     *
     * @param request the HTTP request to send
     * @return the HTTP response
     * @throws IOException if an I/O error occurs
     * @throws InterruptedException if the request is interrupted
     */
    protected HttpResponse<String> sendRequest(HttpRequest request) throws IOException, InterruptedException {
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    /**
     * Build and execute a <strong>GET</strong> request that includes an X-PAYMENT
     * header proving the caller intends to pay {@code amount} of {@code assetContract}
     * to {@code payTo}.
     *
     * @param uri           destination (must include path)
     * @param amount        amount in atomic units (wei, lamports, etc.)
     * @param assetContract token contract address (incl. 0x prefix) or symbol
     * @param payTo         receiver address (same chain as asset)
     */
    public HttpResponse<String> get(URI uri,
                                    BigInteger amount,
                                    String assetContract,
                                    String payTo)
            throws IOException, InterruptedException {

        /* ---------- Build scheme-specific payload map ------------------- */
        Map<String,Object> pl = new LinkedHashMap<>();
        pl.put("amount",   amount.toString());
        pl.put("asset",    assetContract);
        pl.put("payTo",    payTo);
        pl.put("resource", uri.getPath());
        pl.put("nonce",    UUID.randomUUID().toString());
        try {
            pl.put("signature", signer.sign(pl));      // <-- signer injected
        } catch (CryptoSignException e) {
            throw new RuntimeException("Failed to sign payment payload", e);
        }
        /* ---------------------------------------------------------------- */

        PaymentPayload p = new PaymentPayload();
        p.t402Version = t402Version;
        p.scheme      = scheme;
        p.network     = network;
        p.payload     = pl;

        HttpRequest req = HttpRequest.newBuilder()
                .uri(uri)
                .header("X-PAYMENT", p.toHeader())
                .GET()
                .build();

        return sendRequest(req);
    }
}
