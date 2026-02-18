package io.t402.wdk.hardware;

/**
 * Configuration for hardware wallet connection.
 */
public class HardwareWalletConfig {

    /** Default BIP-44 derivation path for Ethereum. */
    public static final String DEFAULT_DERIVATION_PATH = "m/44'/60'/0'/0/0";

    private final HardwareWalletType walletType;
    private final String derivationPath;
    private final int chainId;

    public HardwareWalletConfig(HardwareWalletType walletType) {
        this(walletType, DEFAULT_DERIVATION_PATH, 1);
    }

    public HardwareWalletConfig(HardwareWalletType walletType, String derivationPath, int chainId) {
        if (walletType == null) {
            throw new IllegalArgumentException("Wallet type is required");
        }
        this.walletType = walletType;
        this.derivationPath = derivationPath != null ? derivationPath : DEFAULT_DERIVATION_PATH;
        this.chainId = chainId;
    }

    public HardwareWalletType getWalletType() {
        return walletType;
    }

    public String getDerivationPath() {
        return derivationPath;
    }

    public int getChainId() {
        return chainId;
    }
}
