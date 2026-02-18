package io.t402.wdk.hardware;

/**
 * Supported hardware wallet types.
 */
public enum HardwareWalletType {
    LEDGER("ledger"),
    TREZOR("trezor");

    private final String value;

    HardwareWalletType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
