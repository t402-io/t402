package io.t402.model;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PaymentPayloadTest {

    @Test
    void headerRoundTripMaintainsFields() throws Exception {
        PaymentPayload p = new PaymentPayload();
        p.t402Version = 1;
        p.scheme  = "exact";
        p.network = "base-sepolia";
        p.payload = Map.of(
                "amount", "123",
                "resource", "/weather",
                "nonce", "abc"
        );

        String header = p.toHeader();
        PaymentPayload decoded = PaymentPayload.fromHeader(header);

        assertEquals(p.t402Version, decoded.t402Version);
        assertEquals(p.scheme,      decoded.scheme);
        assertEquals(p.network,     decoded.network);
        assertEquals(p.payload,     decoded.payload);
    }
}
