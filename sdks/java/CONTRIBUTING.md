# Java SDK Contributing Guide

Guide for developing and contributing to the t402 Java SDK.

## Contents

- [Repository Structure](#repository-structure)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Code Quality](#code-quality)

## Repository Structure

The Java SDK uses Maven for build management.

```
java/
├── src/
│   ├── main/java/io/t402/
│   │   ├── client/           # HTTP client implementation
│   │   │   ├── T402HttpClient.java
│   │   │   ├── FacilitatorClient.java
│   │   │   └── HttpFacilitatorClient.java
│   │   │
│   │   ├── server/           # Server-side components
│   │   │   ├── PaymentFilter.java
│   │   │   └── PaymentHandler.java
│   │   │
│   │   ├── crypto/           # Signing implementations
│   │   │   ├── CryptoSigner.java     # Interface
│   │   │   ├── EvmSigner.java        # EVM (EIP-3009)
│   │   │   ├── SvmSigner.java        # Solana
│   │   │   ├── TonSigner.java        # TON
│   │   │   └── TronSigner.java       # TRON
│   │   │
│   │   ├── erc4337/          # Account abstraction
│   │   │   ├── UserOperation.java
│   │   │   ├── BundlerClient.java
│   │   │   └── PaymasterClient.java
│   │   │
│   │   ├── bridge/           # USDT0 bridge
│   │   │   ├── Usdt0Bridge.java
│   │   │   └── LayerZeroScanClient.java
│   │   │
│   │   ├── wdk/              # WDK integration
│   │   │   ├── WDKSigner.java
│   │   │   └── WDKChains.java
│   │   │
│   │   ├── mcp/              # MCP server
│   │   │   ├── McpServer.java
│   │   │   └── McpTools.java
│   │   │
│   │   ├── spring/           # Spring Boot integration
│   │   │   ├── T402AutoConfiguration.java
│   │   │   └── T402Properties.java
│   │   │
│   │   └── models/           # Data models
│   │       ├── PaymentPayload.java
│   │       ├── PaymentRequirements.java
│   │       └── Authorization.java
│   │
│   └── test/java/io/t402/    # Test sources
│
├── pom.xml                   # Maven configuration
└── CHANGELOG.md              # Version history
```

## Development Setup

### Prerequisites

- Java 17 or higher
- Maven 3.8+
- (Optional) IntelliJ IDEA or Eclipse

### Installation

```bash
cd java

# Install dependencies and build
mvn clean install

# Skip tests for faster build
mvn clean install -DskipTests
```

### IDE Setup

**IntelliJ IDEA:**
1. Open the `java/` directory as a Maven project
2. Enable annotation processing (Settings → Build → Compiler → Annotation Processors)
3. Import code style from `../.editorconfig`

**Eclipse:**
1. Import as Maven project
2. Install the Checkstyle plugin (optional)

## Development Workflow

### Maven Commands

From the `java/` directory:

| Command | Description |
|---------|-------------|
| `mvn clean install` | Build and install to local repository |
| `mvn test` | Run unit tests |
| `mvn test -Pcoverage` | Run tests with coverage report |
| `mvn verify` | Run all verifications |
| `mvn checkstyle:check` | Check code style |
| `mvn spotbugs:check` | Run static analysis |
| `mvn javadoc:javadoc` | Generate Javadoc |

### Quick Verification

Before submitting changes:

```bash
mvn verify
```

This runs compilation, tests, checkstyle, and spotbugs in sequence.

## Adding Features

### Adding a New Signer

To add support for a new blockchain:

1. Create a new signer class in `src/main/java/io/t402/crypto/`:

```java
package io.t402.crypto;

public class YourChainSigner implements CryptoSigner {

    private final String address;
    private final PrivateKey privateKey;

    public YourChainSigner(String privateKey) {
        // Initialize from private key
    }

    @Override
    public String getAddress() {
        return address;
    }

    @Override
    public String getNetwork() {
        return "yourchain:mainnet";
    }

    @Override
    public Map<String, Object> sign(Map<String, Object> payload) {
        // Implement signing logic
        return signedPayload;
    }
}
```

2. Add corresponding tests in `src/test/java/io/t402/crypto/`.

3. Update the README.md with usage examples.

### Adding Spring Boot Features

Spring Boot integration lives in `src/main/java/io/t402/spring/`:

1. Add new properties to `T402Properties.java`
2. Add auto-configuration in `T402AutoConfiguration.java`
3. Document properties in README.md

### Adding MCP Tools

MCP tools are defined in `src/main/java/io/t402/mcp/McpTools.java`:

1. Add a new tool handler method
2. Register the tool in `McpServer.java`
3. Add tests for the new tool

## Testing

### Unit Tests

```bash
# All tests
mvn test

# With coverage
mvn test -Pcoverage

# Specific test class
mvn test -Dtest=EvmSignerTest

# Specific test method
mvn test -Dtest=EvmSignerTest#testSignPayload
```

### Integration Tests

Integration tests require network access:

```bash
# Set up environment
cp .env.example .env
# Edit .env with your test credentials

# Run integration tests
mvn verify -Pintegration-tests
```

### Test Organization

```
src/test/java/io/t402/
├── client/           # Client tests
├── server/           # Server tests
├── crypto/           # Signer tests
├── erc4337/          # ERC-4337 tests
├── bridge/           # Bridge tests
├── wdk/              # WDK tests
├── mcp/              # MCP tests
└── spring/           # Spring Boot tests
```

### Mocking

Use Mockito for mocking:

```java
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentFilterTest {

    @Mock
    private FacilitatorClient facilitator;

    @InjectMocks
    private PaymentFilter filter;

    @Test
    void testVerifyPayment() {
        when(facilitator.verify(any())).thenReturn(new VerificationResponse(true));
        // ...
    }
}
```

## Code Quality

### Checkstyle

The project uses [Checkstyle](https://checkstyle.sourceforge.io/):

```bash
mvn checkstyle:check
```

Configuration is in `checkstyle.xml`.

### SpotBugs

Static analysis with [SpotBugs](https://spotbugs.github.io/):

```bash
mvn spotbugs:check
```

### Code Style

- Follow standard Java conventions
- Use meaningful variable and function names
- Add Javadoc comments on public classes and methods
- Handle exceptions explicitly
- Use `Optional` for nullable return values
- Prefer immutable objects

### Error Handling

Use typed exceptions:

```java
public class PaymentVerificationException extends T402Exception {
    public PaymentVerificationException(String message) {
        super(message);
    }

    public PaymentVerificationException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

### Logging

Use SLF4J:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PaymentFilter {
    private static final Logger logger = LoggerFactory.getLogger(PaymentFilter.class);

    public void doFilter(...) {
        logger.debug("Processing payment request");
        // ...
    }
}
```

## Examples

Examples live in `examples/java/`. When adding a new example:

1. Create a new Maven module under `examples/java/`
2. Add a `pom.xml` that depends on the SDK
3. Add a `README.md` with setup and run instructions
4. Include a working `src/main/java/` with example code

Example `pom.xml`:

```xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>io.t402.examples</groupId>
    <artifactId>your-example</artifactId>
    <version>1.0.0</version>

    <dependencies>
        <dependency>
            <groupId>io.t402</groupId>
            <artifactId>t402</artifactId>
            <version>1.1.0</version>
        </dependency>
    </dependencies>
</project>
```

## Documentation

Update documentation when adding features:

- `README.md` - Main SDK documentation
- `CHANGELOG.md` - Version history
- Javadoc comments on public APIs

## Publishing

The Java SDK is published to Maven Central. Version tags follow semver:

```
java/v1.0.0
java/v1.1.0
java/v2.0.0
```

Releases are handled by maintainers. See [RELEASING.md](../RELEASING.md) for details.

## Getting Help

- Open an issue on GitHub
- Check the [examples](../examples/java/) for usage patterns
- Reference the [README.md](README.md) for API documentation
