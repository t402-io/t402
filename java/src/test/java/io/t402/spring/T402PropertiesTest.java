package io.t402.spring;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class T402PropertiesTest {

    @Test
    void parseAmountAtomicUnits() {
        T402Properties props = new T402Properties();

        // Atomic units (no conversion needed)
        assertEquals(BigInteger.valueOf(10000), props.parseAmount("10000"));
        assertEquals(BigInteger.valueOf(1000000), props.parseAmount("1000000"));
        assertEquals(BigInteger.valueOf(100), props.parseAmount("100"));
    }

    @Test
    void parseAmountDollarNotation() {
        T402Properties props = new T402Properties();
        props.setTokenDecimals(6);

        // Dollar notation ($X.XX)
        assertEquals(BigInteger.valueOf(10000), props.parseAmount("$0.01"));
        assertEquals(BigInteger.valueOf(100000), props.parseAmount("$0.10"));
        assertEquals(BigInteger.valueOf(1000000), props.parseAmount("$1.00"));
        assertEquals(BigInteger.valueOf(1500000), props.parseAmount("$1.50"));
        assertEquals(BigInteger.valueOf(10000000), props.parseAmount("$10.00"));
    }

    @Test
    void parseAmountDecimalNotation() {
        T402Properties props = new T402Properties();
        props.setTokenDecimals(6);

        // Decimal notation (X.XX without $)
        assertEquals(BigInteger.valueOf(10000), props.parseAmount("0.01"));
        assertEquals(BigInteger.valueOf(100000), props.parseAmount("0.10"));
        assertEquals(BigInteger.valueOf(1000000), props.parseAmount("1.00"));
        assertEquals(BigInteger.valueOf(1500000), props.parseAmount("1.50"));
    }

    @Test
    void parseAmountWithDifferentDecimals() {
        T402Properties props = new T402Properties();

        // 18 decimals (like USDT0)
        props.setTokenDecimals(18);
        assertEquals(new BigInteger("10000000000000000"), props.parseAmount("$0.01"));
        assertEquals(new BigInteger("1000000000000000000"), props.parseAmount("$1.00"));

        // 8 decimals (like BTC)
        props.setTokenDecimals(8);
        assertEquals(BigInteger.valueOf(1000000), props.parseAmount("$0.01"));
        assertEquals(BigInteger.valueOf(100000000), props.parseAmount("$1.00"));
    }

    @Test
    void parseAmountNullOrEmpty() {
        T402Properties props = new T402Properties();
        props.setDefaultAmount("10000");

        // Null or empty should return default
        assertEquals(BigInteger.valueOf(10000), props.parseAmount(null));
        assertEquals(BigInteger.valueOf(10000), props.parseAmount(""));
    }

    @Test
    void parseAmountWithWhitespace() {
        T402Properties props = new T402Properties();
        props.setTokenDecimals(6);

        // Should handle whitespace
        assertEquals(BigInteger.valueOf(10000), props.parseAmount("  $0.01  "));
        assertEquals(BigInteger.valueOf(10000), props.parseAmount("  0.01  "));
        assertEquals(BigInteger.valueOf(10000), props.parseAmount("  10000  "));
    }

    @Test
    void defaultProperties() {
        T402Properties props = new T402Properties();

        assertFalse(props.isEnabled());
        assertEquals("https://facilitator.t402.io", props.getFacilitatorUrl());
        assertEquals("eip155:8453", props.getNetwork());
        assertEquals("exact", props.getScheme());
        assertEquals(6, props.getTokenDecimals());
        assertEquals(3600, props.getMaxTimeoutSeconds());
        assertNotNull(props.getRoutes());
        assertTrue(props.getRoutes().isEmpty());
    }

    @Test
    void routeConfiguration() {
        T402Properties props = new T402Properties();

        RouteConfig route1 = new RouteConfig();
        route1.setPath("/api/premium/**");
        route1.setAmount("$1.00");
        route1.setDescription("Premium API access");

        RouteConfig route2 = new RouteConfig();
        route2.setPath("/api/basic/*");
        route2.setAmount("10000");
        route2.setEnabled(false);

        props.setRoutes(List.of(route1, route2));

        assertEquals(2, props.getRoutes().size());
        assertEquals("/api/premium/**", props.getRoutes().get(0).getPath());
        assertEquals("$1.00", props.getRoutes().get(0).getAmount());
        assertTrue(props.getRoutes().get(0).isEnabled());
        assertFalse(props.getRoutes().get(1).isEnabled());
    }
}
