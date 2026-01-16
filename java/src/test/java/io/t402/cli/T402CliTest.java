package io.t402.cli;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.util.Base64;

/**
 * Tests for T402Cli.
 */
class T402CliTest {

    @Test
    void versionCommand() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        System.setOut(new PrintStream(out));

        try {
            T402Cli cli = new T402Cli();
            cli.run(new String[] { "version" });

            String output = out.toString();
            assertTrue(output.contains(T402Cli.VERSION));
            assertTrue(output.contains("Protocol Version"));
        } finally {
            System.setOut(originalOut);
        }
    }

    @Test
    void versionCommandJson() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        System.setOut(new PrintStream(out));

        try {
            T402Cli cli = new T402Cli();
            cli.run(new String[] { "-o", "json", "version" });

            String output = out.toString();
            assertTrue(output.contains("\"version\""));
            assertTrue(output.contains("\"protocol_version\""));
        } finally {
            System.setOut(originalOut);
        }
    }

    @Test
    void decodeCommand() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        System.setOut(new PrintStream(out));

        try {
            String json = "{\"test\":\"value\"}";
            String base64 = Base64.getEncoder().encodeToString(json.getBytes());

            T402Cli cli = new T402Cli();
            cli.run(new String[] { "decode", base64 });

            String output = out.toString();
            assertTrue(output.contains("\"test\""));
            assertTrue(output.contains("\"value\""));
        } finally {
            System.setOut(originalOut);
        }
    }

    @Test
    void infoCommand() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        System.setOut(new PrintStream(out));

        try {
            T402Cli cli = new T402Cli();
            cli.run(new String[] { "info", "eip155:1" });

            String output = out.toString();
            assertTrue(output.contains("Network: eip155:1"));
            assertTrue(output.contains("Is EVM: true"));
        } finally {
            System.setOut(originalOut);
        }
    }

    @Test
    void infoCommandJson() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        System.setOut(new PrintStream(out));

        try {
            T402Cli cli = new T402Cli();
            cli.run(new String[] { "-o", "json", "info", "ton:mainnet" });

            String output = out.toString();
            assertTrue(output.contains("\"is_ton\" : true"));
            assertTrue(output.contains("\"is_evm\" : false"));
        } finally {
            System.setOut(originalOut);
        }
    }

    @Test
    void helpCommand() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        System.setOut(new PrintStream(out));

        try {
            T402Cli cli = new T402Cli();
            cli.run(new String[] { "help" });

            String output = out.toString();
            assertTrue(output.contains("T402 CLI"));
            assertTrue(output.contains("Usage:"));
            assertTrue(output.contains("Commands:"));
        } finally {
            System.setOut(originalOut);
        }
    }

    @Test
    void emptyArgs() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        System.setOut(new PrintStream(out));

        try {
            T402Cli cli = new T402Cli();
            cli.run(new String[] {});

            String output = out.toString();
            assertTrue(output.contains("T402 CLI"));
        } finally {
            System.setOut(originalOut);
        }
    }

    @Test
    void constants() {
        assertEquals("2.0.0", T402Cli.VERSION);
        assertEquals(2, T402Cli.PROTOCOL_VERSION);
        assertEquals("https://facilitator.t402.io", T402Cli.DEFAULT_FACILITATOR);
    }
}
