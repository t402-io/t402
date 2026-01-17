# Changelog - Java SDK

All notable changes to the T402 Java SDK will be documented in this file.

## [Unreleased]

### Added
- **Up-To Scheme Types** (`io.t402.schemes.upto`, `io.t402.schemes.evm.upto`) - Usage-based billing scheme
  - Core types (`io.t402.schemes.upto`):
    - `UptoPaymentRequirements` - Payment requirements with `maxAmount` for usage-based billing
    - `UptoExtra` - Extra fields for billing units and EIP-712 domain parameters
    - `UptoSettlement` - Settlement data with usage details
    - `UptoUsageDetails` - Usage tracking metrics
    - `UptoSettlementResponse` - Settlement transaction response with factory methods
    - `UptoValidationResult` - Payment validation result with factory methods
    - `UptoConstants` - Scheme constants and supported units
    - `UptoUtils` - Helper functions (`isUptoPaymentRequirements()`, factories)
  - EVM types (`io.t402.schemes.evm.upto`):
    - `PermitSignature` - EIP-2612 signature (v, r, s)
    - `PermitAuthorization` - Permit authorization parameters with builder
    - `UptoEIP2612Payload` - Complete EIP-2612 permit payload with map conversion
    - `UptoEvmExtra` - EVM-specific extra fields
    - `UptoEvmSettlement` - EVM settlement with usage details
    - `UptoEvmUsageDetails` - EVM usage tracking
    - `UptoEvmTypes` - EIP-712 type definitions and helper functions
      - `PERMIT_TYPE_FIELDS`, `DOMAIN_TYPE_FIELDS`
      - `createPermitDomain()`, `createPermitMessage()`
      - `isEIP2612Payload()` - Type guard for EIP-2612 payloads

## [1.1.0] - 2026-01-16

### Added

#### Protocol v2 Support
- `ResourceInfo` - New class for describing protected resources (url, description, mimeType)
- `PaymentPayload.Builder` - Builder pattern for creating v2 payment payloads
- `PaymentPayload.getEffectiveScheme()` / `getEffectiveNetwork()` - Helper methods supporting both v1 and v2 formats
- `SupportedResponse` - Full response from /supported endpoint including extensions and signers
- `SupportedResponse.supports()` - Helper method to check scheme/network support
- `SupportedResponse.getSignersForNetwork()` - Wildcard pattern matching for signer lookup

#### Enhanced PaymentFilter
- Custom network and asset configuration via constructor
- Support for v2 resource.url matching
- Backward compatibility with v1 payload.resource format
- CAIP-2 network format (e.g., `eip155:8453`)

#### Spring Boot Enhancement
- `@RequirePayment` - Method/class-level annotation for payment protection
- `RouteConfig` - YAML-based route pricing configuration
- `PaymentInterceptor` - HandlerInterceptor for annotation-based payment validation
- `T402WebMvcConfigurer` - Auto-registers PaymentInterceptor for Spring MVC
- `T402Properties.parseAmount()` - Amount parsing with multiple formats:
  - Atomic units: `"1000000"` (raw blockchain units)
  - Dollar notation: `"$1.00"` (human-readable)
  - Decimal notation: `"1.00"` (decimal without $)

#### Spring WebFlux Support (Reactive)
- `PaymentWebFilter` - WebFilter for reactive WebFlux applications
- `T402WebFluxConfiguration` - Auto-configuration for WebFlux
- Route-based payment protection for reactive endpoints
- Async payment verification and settlement with Reactor

#### ERC-4337 Account Abstraction Enhancements
- `SafeAccount` - Safe smart account integration for ERC-4337
  - `encodeExecTransaction()` - Encode Safe transaction calls
  - `encodeExecuteUserOp()` - Encode 4337 module calls
  - `encodeBatchCalls()` - Batch multiple calls with multiSend
  - `createInitCode()` - Generate init code for Safe deployment
  - `getSafeTransactionHash()` - Compute Safe transaction hash for signing
  - `signSafeTransaction()` - Sign Safe transactions
- `SafeCall` - Represents individual calls in batch transactions
- `Operation` - Enum for CALL vs DELEGATECALL operations

#### Bundler Provider Integrations
- `PimlicoBundler` - Pimlico bundler client with:
  - `sponsorUserOperation()` - Gas sponsorship via Pimlico paymaster
  - `validateSponsorshipPolicies()` - Validate sponsorship policy IDs
  - `getUserOperationGasPrice()` - Get recommended gas prices (slow/standard/fast)
  - `getAccountNonce()` - Get account nonce from bundler
- `AlchemyBundler` - Alchemy bundler client with:
  - `requestPaymasterAndData()` - Get paymaster data
  - `requestGasAndPaymasterAndData()` - Combined gas + paymaster in one call
  - `simulateUserOperation()` - Simulate UserOp for error checking
  - `getMaxPriorityFeePerGas()` - Get current priority fee
- `BundlerFactory` - Factory pattern for creating bundler clients
- `BundlerProvider` - Enum for PIMLICO, ALCHEMY, CUSTOM providers

#### UserOperation v0.7 Enhancements
- `UserOperation.ENTRYPOINT_V07` - EntryPoint v0.7 address constant
- `UserOperation.getUserOpHash()` - Compute UserOperation hash for signing
- `UserOperation.pack()` - Pack to v0.7 RPC format
- `UserOperation.PackedUserOperation` - Packed format with accountGasLimits and gasFees
- New v0.7 fields: `factory`, `factoryData`, `paymaster`, `paymasterVerificationGasLimit`,
  `paymasterPostOpGasLimit`, `paymasterData`
- `Builder.gasEstimate()` - Apply GasEstimate to builder
- Backward compatibility: `initCode` and `paymasterAndData` still work

### Changed

#### Breaking: PaymentRequirements
- `maxAmountRequired` renamed to `amount` (v1 field still accepted via `@JsonAlias`)
- `resource`, `description`, `mimeType`, `outputSchema` moved to `ResourceInfo` class
- Fields marked as `@Deprecated` with `@JsonIgnore` for backward compatibility

#### Breaking: PaymentPayload
- Added `resource` field (ResourceInfo) for v2 format
- Added `accepted` field (PaymentRequirements) for v2 format - the payment method chosen by client
- Added `extensions` field for protocol extensions
- `scheme` and `network` fields deprecated (use `accepted.scheme` and `accepted.network`)
- Default `t402Version` changed from 1 to 2

#### Breaking: PaymentRequiredResponse
- Added `resource` field (ResourceInfo) for v2 format
- Added `extensions` field for protocol extensions
- Default `t402Version` changed from 1 to 2

#### HttpFacilitatorClient
- `/verify` and `/settle` now send full `PaymentPayload` object instead of just header string
- Request body format changed to `{ paymentPayload: {...}, paymentRequirements: {...} }`
- Added `supportedFull()` method for complete /supported response

#### Kind
- Added `t402Version` field (default: 2)
- Added `extra` field for scheme-specific configuration

#### T402AutoConfiguration
- Added `PaymentInterceptor` bean for annotation-based payment validation
- Added `T402WebMvcConfigurer` bean for interceptor registration
- Added `@ConditionalOnWebApplication(Type.SERVLET)` for servlet/reactive detection

#### T402Properties
- Added `routes` - List of `RouteConfig` for path-based pricing
- Added `enabled` - Global enable/disable toggle (default: false)
- Added `defaultAmount` - Default payment amount when not specified
- Added `tokenDecimals` - Token decimal places for amount parsing (default: 6)
- Added `parseAmount()` - Convert human-readable amounts to atomic units

### Migration Guide

**From v1 PaymentPayload to v2:**
```java
// v1 (deprecated)
PaymentPayload p = new PaymentPayload();
p.t402Version = 1;
p.scheme = "exact";
p.network = "base-sepolia";
p.payload = Map.of("resource", "/api/data", ...);

// v2 (recommended)
PaymentPayload p = PaymentPayload.builder()
    .resource("https://api.example.com/data", "Premium API", "application/json")
    .accepted(new PaymentRequirements("exact", "eip155:84532", "USDC", "10000", "0xPayTo", 30))
    .payload(Map.of("signature", "0x...", "authorization", Map.of(...)))
    .build();
```

**Network format change:**
- Old: `"base-sepolia"`, `"base"`, `"solana-devnet"`
- New: `"eip155:84532"`, `"eip155:8453"`, `"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"`

### Spring Boot Usage

**Using @RequirePayment annotation:**
```java
@RestController
public class ApiController {

    // Method-level annotation
    @RequirePayment(amount = "$0.01")
    @GetMapping("/api/premium")
    public String premiumEndpoint() {
        return "Premium content";
    }
}

// Class-level annotation (applies to all methods)
@RestController
@RequirePayment(amount = "$1.00")
public class PremiumController {

    @GetMapping("/premium/data")
    public String getData() {
        return "Premium data";
    }

    // Method annotation overrides class annotation
    @RequirePayment(amount = "$5.00")
    @GetMapping("/premium/expensive")
    public String expensiveData() {
        return "Expensive data";
    }
}
```

**Using YAML route configuration:**
```yaml
t402:
  enabled: true
  pay-to: "0xYourWalletAddress"
  network: "eip155:8453"
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base
  token-decimals: 6
  routes:
    - path: /api/premium/**
      amount: "$1.00"
      description: "Premium API access"
    - path: /api/basic/*
      amount: "10000"
      enabled: true
```

**WebFlux reactive applications:**
```java
@RestController
public class ReactiveController {

    @GetMapping("/api/premium/data")
    public Mono<String> premiumData() {
        return Mono.just("Premium reactive content");
    }
}
```
Note: WebFlux uses route-based configuration only. `@RequirePayment` annotation is not supported in reactive applications.

### ERC-4337 Usage

**Using SafeAccount for smart wallet transactions:**
```java
// Create Safe account helper
SafeAccount safe = SafeAccount.builder()
    .safeAddress("0xYourSafeAddress")
    .owner(Credentials.create(privateKey))
    .chainId(8453)
    .build();

// Encode a transfer call
String callData = safe.encodeExecuteUserOp(
    tokenAddress,
    BigInteger.ZERO,
    transferData,
    Operation.CALL
);

// Create UserOperation
UserOperation userOp = UserOperation.builder()
    .sender(safe.getSafeAddress())
    .callData(callData)
    .build();
```

**Using BundlerFactory:**
```java
// Create Pimlico bundler
PimlicoBundler pimlico = BundlerFactory.pimlico()
    .apiKey("your-pimlico-api-key")
    .chainId(8453)
    .buildPimlico();

// Sponsor and send UserOperation
UserOperation sponsored = pimlico.sponsorUserOperation(userOp);
String userOpHash = pimlico.sendUserOperation(sponsored);

// Create Alchemy bundler
AlchemyBundler alchemy = BundlerFactory.alchemy()
    .apiKey("your-alchemy-api-key")
    .chainId(8453)
    .policyId("gas-manager-policy-id")
    .buildAlchemy();

// Get gas + paymaster in one call
UserOperation ready = alchemy.requestGasAndPaymasterAndData(userOp);
```

**UserOperation v0.7 format:**
```java
// Using new v0.7 fields
UserOperation op = UserOperation.builder()
    .sender("0xSmartWallet")
    .factory("0xFactoryAddress")
    .factoryData("0x...")
    .callData("0x...")
    .paymaster("0xPaymaster")
    .paymasterVerificationGasLimit(BigInteger.valueOf(100000))
    .paymasterPostOpGasLimit(BigInteger.valueOf(50000))
    .paymasterData("0x...")
    .build();

// Compute hash for signing
byte[] hash = op.getUserOpHash(8453);

// Or use backward-compatible fields
UserOperation legacy = UserOperation.builder()
    .sender("0xSmartWallet")
    .initCode("0xFactoryAddress" + "factoryData")  // Combined format
    .paymasterAndData("0xPaymaster" + gasLimits + data)  // Combined format
    .callData("0x...")
    .build();
```

## [1.0.0] - 2026-01-16

Initial release of the T402 Java SDK, published to Maven Central.

### Added

#### Core Features
- `T402HttpClient` - HTTP client with automatic payment header handling
- `FacilitatorClient` / `HttpFacilitatorClient` - Facilitator integration for verification and settlement
- `PaymentFilter` - Jakarta Servlet filter for payment-protected endpoints
- `PaymentPayload` / `PaymentRequirements` - Core payment types

#### Multi-Chain Signers
- `EvmSigner` - EIP-3009 TransferWithAuthorization signing with Web3j
- `SvmSigner` - Solana (SVM) Ed25519 signing with Base58 encoding
- `TonSigner` - TON Ed25519 signing with Base64 encoding
- `TronSigner` - TRON ECDSA secp256k1 signing with Base58Check

#### ERC-4337 Account Abstraction
- `UserOperation` - ERC-4337 v0.7 UserOperation structure
- `BundlerClient` - Bundler JSON-RPC client for UserOperation submission
- `PaymasterClient` - Paymaster integration for gas sponsorship
- `GasEstimate` - Gas estimation types
- `PaymasterData` - Paymaster data encoding/decoding

#### USDT0 Cross-Chain Bridge
- `Usdt0Bridge` - LayerZero OFT bridge client
- `LayerZeroScanClient` - Message tracking via LayerZero Scan API
- `BridgeConstants` - Chain endpoints, USDT0 addresses, utilities
- `BridgeTypes` - Quote, execute, result types
- `BridgeSigner` - Interface for bridge transactions

#### WDK Integration
- `WDKSigner` - BIP-39 seed phrase derivation compatible with Tether WDK
- `WDKChains` - Chain configuration, token addresses
- `WDKTypes` - Configuration, balance, payment types

#### CLI Tool
- `T402Cli` - Command-line interface
- Commands: verify, settle, supported, encode, decode, info, version
- JSON and text output formats
- Configurable facilitator URL

#### Spring Boot Integration
- `T402AutoConfiguration` - Auto-configuration for Spring Boot 3.x
- `T402Properties` - Configuration properties (`t402.*`)
- Automatic `PaymentFilter` registration for `/api/*` endpoints

#### Models
- `Authorization` - EIP-3009 authorization structure
- `ExactSchemePayload` - Exact payment scheme payload
- `VerificationResponse` / `SettlementResponse` - Facilitator responses

### Infrastructure
- Maven Central publishing via Sonatype Central Portal
- GPG signing for all artifacts
- JaCoCo code coverage
- Checkstyle and SpotBugs static analysis
- GitHub Actions CI/CD workflows
- Auto-publish on tag push (`java/v*`)

### Installation

**Maven:**
```xml
<dependency>
  <groupId>io.t402</groupId>
  <artifactId>t402</artifactId>
  <version>1.0.0</version>
</dependency>
```

**Gradle:**
```groovy
implementation 'io.t402:t402:1.0.0'
```

[Unreleased]: https://github.com/t402-io/t402/compare/java/v1.1.0...HEAD
[1.1.0]: https://github.com/t402-io/t402/compare/java/v1.0.0...java/v1.1.0
[1.0.0]: https://github.com/t402-io/t402/releases/tag/java/v1.0.0
