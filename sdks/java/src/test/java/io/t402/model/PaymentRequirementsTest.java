package io.t402.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PaymentRequirementsTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void serializationRoundTrip() throws Exception {
        PaymentRequirements req = new PaymentRequirements();
        req.scheme = "exact";
        req.network = "eip155:8453";
        req.asset = "0x2dcfEABdc9129E0d0B052D4d3FAE37E1041c5FC1";
        req.amount = "1000000";
        req.payTo = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";
        req.maxTimeoutSeconds = 3600;

        String json = mapper.writeValueAsString(req);
        PaymentRequirements deserialized = mapper.readValue(json, PaymentRequirements.class);

        assertEquals("exact", deserialized.scheme);
        assertEquals("eip155:8453", deserialized.network);
        assertEquals("1000000", deserialized.amount);
        assertEquals("0xC88f67e776f16DcFBf42e6bDda1B82604448899B", deserialized.payTo);
        assertEquals(3600, deserialized.maxTimeoutSeconds);
    }

    @Test
    void v1BackwardCompatibility() throws Exception {
        // V1 used "maxAmountRequired" instead of "amount"
        String v1Json = """
            {"scheme":"exact","network":"eip155:1","maxAmountRequired":"500000","payTo":"0xabc"}
            """;
        PaymentRequirements req = mapper.readValue(v1Json, PaymentRequirements.class);
        assertEquals("500000", req.amount);
    }

    @Test
    void nullFieldsOmitted() throws Exception {
        PaymentRequirements req = new PaymentRequirements();
        req.scheme = "exact";
        req.network = "eip155:1";

        String json = mapper.writeValueAsString(req);
        assertFalse(json.contains("\"amount\""));
        assertFalse(json.contains("\"extra\""));
        assertTrue(json.contains("\"scheme\""));
    }

    @Test
    void extraFieldsPreserved() throws Exception {
        String json = """
            {"scheme":"exact","network":"eip155:1","amount":"100","extra":{"custom":"value"}}
            """;
        PaymentRequirements req = mapper.readValue(json, PaymentRequirements.class);
        assertNotNull(req.extra);
        assertEquals("value", req.extra.get("custom"));
    }
}
