package io.t402.cli;

import io.t402.util.Json;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Base64;
import java.util.Map;

/**
 * T402 CLI - Command-line interface for the T402 payment protocol.
 *
 * <p>Usage:
 * <pre>
 *     t402 encode &lt;json-file&gt;          Encode a JSON file to base64
 *     t402 decode &lt;base64-string&gt;      Decode base64 payload to JSON
 *     t402 info &lt;network&gt;              Show information about a network
 *     t402 version                      Show version information
 * </pre>
 */
public class T402Cli {

    /** T402 SDK version. */
    public static final String VERSION = "2.0.0";

    /** T402 protocol version. */
    public static final int PROTOCOL_VERSION = 2;

    /** Default facilitator URL. */
    public static final String DEFAULT_FACILITATOR = "https://facilitator.t402.io";

    private String outputFormat = "text";

    /**
     * Main entry point.
     */
    public static void main(String[] args) {
        T402Cli cli = new T402Cli();
        cli.run(args);
    }

    /**
     * Run the CLI with the given arguments.
     */
    public void run(String[] args) {
        if (args.length == 0) {
            printUsage();
            return;
        }

        // Parse global flags and get remaining args
        String[] remaining = parseGlobalFlags(args);

        if (remaining.length == 0) {
            printUsage();
            return;
        }

        String command = remaining[0];
        String[] cmdArgs = new String[remaining.length - 1];
        System.arraycopy(remaining, 1, cmdArgs, 0, cmdArgs.length);

        try {
            switch (command) {
                case "encode":
                    cmdEncode(cmdArgs);
                    break;
                case "decode":
                    cmdDecode(cmdArgs);
                    break;
                case "info":
                    cmdInfo(cmdArgs);
                    break;
                case "version":
                    cmdVersion();
                    break;
                case "-h":
                case "--help":
                case "help":
                    printUsage();
                    break;
                default:
                    System.err.println("Error: Unknown command '" + command + "'");
                    System.err.println();
                    printUsage();
                    System.exit(1);
            }
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            System.exit(1);
        }
    }

    private String[] parseGlobalFlags(String[] args) {
        java.util.List<String> remaining = new java.util.ArrayList<>();

        int i = 0;
        while (i < args.length) {
            switch (args[i]) {
                case "-o":
                case "--output":
                    if (i + 1 < args.length) {
                        outputFormat = args[i + 1];
                        if (!outputFormat.equals("json") && !outputFormat.equals("text")) {
                            System.err.println("Error: --output must be 'json' or 'text'");
                            System.exit(1);
                        }
                        i += 2;
                    } else {
                        System.err.println("Error: --output requires a format");
                        System.exit(1);
                    }
                    break;
                default:
                    remaining.add(args[i]);
                    i++;
            }
        }

        return remaining.toArray(new String[0]);
    }

    private void printUsage() {
        System.out.println("T402 CLI - Command-line interface for the T402 payment protocol");
        System.out.println();
        System.out.println("Usage:");
        System.out.println("    t402 [flags] <command> [arguments]");
        System.out.println();
        System.out.println("Commands:");
        System.out.println("    encode <json-file>          Encode a JSON file to base64");
        System.out.println("    decode <base64-string>      Decode base64 payload to JSON");
        System.out.println("    info <network>              Show information about a network");
        System.out.println("    version                     Show version information");
        System.out.println();
        System.out.println("Flags:");
        System.out.println("    -o, --output FORMAT         Output format: json, text (default: text)");
        System.out.println("    -h, --help                  Show this help message");
        System.out.println();
        System.out.println("Examples:");
        System.out.println("    # Encode payment to base64");
        System.out.println("    t402 encode payment.json");
        System.out.println();
        System.out.println("    # Decode base64 payload");
        System.out.println("    t402 decode eyJ0NDAyVmVyc2lvbiI6MiwuLi59");
        System.out.println();
        System.out.println("    # Show network info");
        System.out.println("    t402 info eip155:1");
    }

    private void cmdEncode(String[] args) throws Exception {
        if (args.length < 1) {
            throw new IllegalArgumentException("usage: t402 encode <json-file>");
        }

        File file = new File(args[0]);
        if (!file.exists()) {
            throw new IOException("File not found: " + args[0]);
        }

        String content = Files.readString(file.toPath());

        // Validate it's valid JSON
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = Json.MAPPER.readValue(content, Map.class);

        // Re-marshal to compact JSON
        byte[] compactJson = Json.MAPPER.writeValueAsBytes(payload);

        // Encode to base64
        String encoded = Base64.getEncoder().encodeToString(compactJson);
        System.out.println(encoded);
    }

    private void cmdDecode(String[] args) throws Exception {
        if (args.length < 1) {
            throw new IllegalArgumentException("usage: t402 decode <base64-string>");
        }

        byte[] payload = decodeBase64Payload(args[0]);

        // Pretty print JSON
        Object data = Json.MAPPER.readValue(payload, Object.class);
        String output = Json.MAPPER.writerWithDefaultPrettyPrinter()
            .writeValueAsString(data);

        System.out.println(output);
    }

    private void cmdInfo(String[] args) throws Exception {
        if (args.length < 1) {
            throw new IllegalArgumentException("usage: t402 info <network>");
        }

        String network = args[0];

        java.util.Map<String, Object> info = new java.util.LinkedHashMap<>();
        info.put("network", network);
        info.put("is_evm", isEVMNetwork(network));
        info.put("is_ton", isTONNetwork(network));
        info.put("is_tron", isTRONNetwork(network));
        info.put("is_svm", isSVMNetwork(network));

        if (outputFormat.equals("json")) {
            String json = Json.MAPPER.writerWithDefaultPrettyPrinter()
                .writeValueAsString(info);
            System.out.println(json);
        } else {
            System.out.println("Network: " + network);
            System.out.println("Is EVM: " + info.get("is_evm"));
            System.out.println("Is TON: " + info.get("is_ton"));
            System.out.println("Is TRON: " + info.get("is_tron"));
            System.out.println("Is SVM: " + info.get("is_svm"));
        }
    }

    private void cmdVersion() throws Exception {
        if (outputFormat.equals("json")) {
            java.util.Map<String, Object> info = new java.util.LinkedHashMap<>();
            info.put("version", VERSION);
            info.put("protocol_version", PROTOCOL_VERSION);
            String json = Json.MAPPER.writerWithDefaultPrettyPrinter()
                .writeValueAsString(info);
            System.out.println(json);
        } else {
            System.out.println("T402 CLI v" + VERSION);
            System.out.println("Protocol Version: " + PROTOCOL_VERSION);
        }
    }

    private byte[] decodeBase64Payload(String encoded) {
        try {
            // Try standard base64 first
            return Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException e1) {
            try {
                // Try URL-safe base64
                return Base64.getUrlDecoder().decode(encoded);
            } catch (IllegalArgumentException e2) {
                throw new IllegalArgumentException("Failed to decode base64: " + encoded);
            }
        }
    }

    private boolean isEVMNetwork(String network) {
        return network.startsWith("eip155:");
    }

    private boolean isTONNetwork(String network) {
        return network.equals("ton:mainnet") || network.equals("ton:testnet") ||
               network.startsWith("ton:");
    }

    private boolean isTRONNetwork(String network) {
        return network.equals("tron:mainnet") || network.equals("tron:nile") ||
               network.equals("tron:shasta") || network.startsWith("tron:");
    }

    private boolean isSVMNetwork(String network) {
        return network.startsWith("solana:") ||
               network.equals("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp") ||
               network.equals("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
    }
}
