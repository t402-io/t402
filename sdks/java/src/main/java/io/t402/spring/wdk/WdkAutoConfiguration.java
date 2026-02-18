package io.t402.spring.wdk;

import io.t402.wdk.gasless.GaslessClient;
import io.t402.wdk.gasless.GaslessConfig;
import io.t402.wdk.bridge.WDKBridgeClient;
import io.t402.wdk.bridge.WDKBridgeConfig;
import io.t402.wdk.multisig.WDKMultisigClient;
import io.t402.wdk.multisig.WDKMultisigConfig;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

/**
 * Spring Boot auto-configuration for T402 WDK features.
 *
 * <p>Provides automatic bean creation for gasless payments, cross-chain bridging,
 * and multi-signature support based on application properties.
 *
 * <p>Enable with:
 * <pre>{@code
 * t402:
 *   wdk:
 *     enabled: true
 * }</pre>
 *
 * @see WdkProperties
 */
@AutoConfiguration
@ConditionalOnProperty(prefix = "t402.wdk", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(WdkProperties.class)
public class WdkAutoConfiguration {

    /**
     * Creates a GaslessClient bean when bundler URL is configured.
     *
     * @param props WDK configuration properties
     * @return Configured GaslessClient
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty("t402.wdk.gasless.bundler-url")
    public GaslessClient gaslessClient(WdkProperties props) {
        final WdkProperties.Gasless gaslessProps = props.getGasless();
        final GaslessConfig config = new GaslessConfig(
                gaslessProps.getBundlerUrl(),
                gaslessProps.getPaymasterUrl(),
                GaslessConfig.ENTRYPOINT_V07_ADDRESS,
                gaslessProps.getChainId(),
                gaslessProps.getTimeoutMs());
        return new GaslessClient(config);
    }

    /**
     * Creates a WDKBridgeClient bean when bridge is enabled.
     *
     * @param props WDK configuration properties
     * @return Configured WDKBridgeClient
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty("t402.wdk.bridge.enabled")
    public WDKBridgeClient bridgeClient(WdkProperties props) {
        final WdkProperties.Bridge bridgeProps = props.getBridge();
        final WDKBridgeConfig config = new WDKBridgeConfig(
                bridgeProps.getRpcUrls(),
                bridgeProps.getDefaultSlippage(),
                600_000);
        return new WDKBridgeClient(config);
    }

    /**
     * Creates a WDKMultisigClient bean when safe address is configured.
     *
     * @param props WDK configuration properties
     * @return Configured WDKMultisigClient
     */
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty("t402.wdk.multisig.safe-address")
    public WDKMultisigClient multisigClient(WdkProperties props) {
        final WdkProperties.Multisig multisigProps = props.getMultisig();
        final WDKMultisigConfig config = new WDKMultisigConfig(
                multisigProps.getSafeAddress(),
                multisigProps.getThreshold(),
                multisigProps.getOwners(),
                multisigProps.getChainId());
        return new WDKMultisigClient(config);
    }
}
