# Mobile TON Reference: Native Wallet Kits for @t402/react-native

This document analyzes how `ton-connect/kit-ios` (Swift) and `ton-connect/kit-android` (Kotlin) can serve as reference implementations for adding native TON support to the `@t402/react-native` package.

## Overview

The TonWalletKit libraries provide native TON Connect protocol implementations for iOS and Android, handling wallet discovery, deep linking, transaction signing, and secure key storage. These libraries are the canonical reference for mobile TON integration and can be bridged to React Native via native modules.

## kit-ios Architecture (Swift)

**Repository**: `ton-connect/kit-ios`

Key modules:
- **TonWalletKit**: Core library for wallet management and TON Connect protocol
- **WalletConnection**: Manages connection lifecycle (connect, disconnect, reconnect)
- **TransactionSender**: Builds and signs Jetton transfer BOCs
- **DeepLinkHandler**: Universal links and custom URL scheme handling for wallet callbacks
- **KeychainStorage**: Secure storage for session keys using iOS Keychain Services

Key features:
- TON Connect v2 protocol implementation
- Wallet manifest discovery and verification
- Biometric authentication (Face ID / Touch ID) via LocalAuthentication framework
- Background session restoration

## kit-android Architecture (Kotlin)

**Repository**: `ton-connect/kit-android`

Key modules:
- **TonWalletKit**: Core library mirroring the iOS API surface
- **WalletConnection**: Connection management with lifecycle-aware components
- **TransactionSender**: BOC construction and signing
- **DeepLinkHandler**: Android Intent-based deep link handling
- **KeystoreStorage**: Secure storage using Android Keystore system

Key features:
- TON Connect v2 protocol implementation
- Biometric authentication via BiometricPrompt API
- Activity result contracts for wallet app callbacks
- Encrypted SharedPreferences for non-sensitive session data

## React Native Bridge Architecture

### Layer Model

```
+--------------------------------------------------+
|  JS Layer (shared across platforms)               |
|  - @t402/react-native hooks and components        |
|  - Payment protocol logic (402 flow)              |
|  - PaymentSheet UI components                     |
+--------------------------------------------------+
|  React Native Bridge (Turbo Modules / NativeModule)|
|  - TonWalletModule.connect()                      |
|  - TonWalletModule.sendTransaction(boc)           |
|  - TonWalletModule.getAddress()                   |
|  - TonWalletModule.disconnect()                   |
+--------------------------------------------------+
|  iOS Native Module         | Android Native Module |
|  Wraps TonWalletKit-iOS    | Wraps TonWalletKit-Android |
|  Keychain for keys         | Keystore for keys     |
|  Face ID / Touch ID        | BiometricPrompt       |
|  Universal Links           | Intent deep links     |
+--------------------------------------------------+
```

### iOS Native Module

The iOS native module wraps `TonWalletKit` and exposes it to JavaScript:

- **Storage**: Uses iOS Keychain Services (via `SecItemAdd`/`SecItemCopyMatching`) for session keys and wallet credentials. This provides hardware-backed encryption on devices with Secure Enclave.
- **Biometric signing**: Wraps `LAContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)` to gate transaction signing behind Face ID or Touch ID.
- **Deep linking**: Registers URL schemes and Universal Links to handle wallet app callbacks. Uses `SceneDelegate.scene(_:openURLContexts:)` or `AppDelegate.application(_:open:options:)`.
- **BOC construction**: Delegates to `TonWalletKit.TransactionSender` for building Jetton transfer BOCs with correct cell serialization.

### Android Native Module

The Android native module wraps `TonWalletKit-Android`:

- **Storage**: Uses Android Keystore (`KeyGenParameterSpec.Builder` with `setUserAuthenticationRequired(true)`) for hardware-backed key storage. Falls back to EncryptedSharedPreferences for session data.
- **Biometric signing**: Wraps `BiometricPrompt.authenticate()` with `CryptoObject` to ensure signing is gated by biometric verification.
- **Deep linking**: Uses Activity result contracts and Intent filters. Configures `AndroidManifest.xml` with `<intent-filter>` for the wallet callback scheme.
- **BOC construction**: Delegates to `TonWalletKit.TransactionSender` for Jetton transfer BOC building.

## API Mapping: Native to JS

| JS API (React Native) | iOS (Swift) | Android (Kotlin) |
|---|---|---|
| `connect(manifestUrl)` | `TonWalletKit.connect(manifest:)` | `TonWalletKit.connect(manifest)` |
| `disconnect()` | `TonWalletKit.disconnect()` | `TonWalletKit.disconnect()` |
| `getAddress()` | `TonWalletKit.address` | `TonWalletKit.address` |
| `sendTransaction(boc)` | `TonWalletKit.sendTransaction(boc:)` | `TonWalletKit.sendTransaction(boc)` |
| `isConnected()` | `TonWalletKit.isConnected` | `TonWalletKit.isConnected` |
| `onStatusChange(cb)` | `TonWalletKit.delegate` | `TonWalletKit.addListener()` |

## Key Challenges

### 1. Native Module Bridging

React Native's bridge layer introduces latency and serialization overhead. For the t402 payment flow:

- **BOC serialization**: The binary BOC format must be Base64-encoded when crossing the bridge. The native side decodes and submits.
- **Async callbacks**: Wallet app callbacks arrive via deep links on the native side and must be forwarded to JS via event emitters.
- **Turbo Modules vs Legacy**: New Architecture (Turbo Modules with JSI) provides synchronous access to native code, reducing latency for `getAddress()` and `isConnected()` calls. Legacy `NativeModule` requires async bridge calls for everything.

### 2. Biometric Authentication

Both platforms require different biometric APIs:

- **iOS**: `LocalAuthentication` with `LAPolicy.deviceOwnerAuthenticationWithBiometrics`
- **Android**: `BiometricPrompt` with `BiometricManager.canAuthenticate(BIOMETRIC_STRONG)`

The JS layer should expose a unified `authenticateBeforeSigning: boolean` config option. The native module handles platform-specific biometric prompts transparently.

### 3. Deep Link Handling

Wallet apps communicate via deep links, which have different handling on each platform:

- **iOS**: Universal Links (AASA file) and custom URL schemes
- **Android**: App Links (assetlinks.json) and Intent filters

The React Native Linking API (`Linking.addEventListener('url', ...)`) can capture incoming URLs, but native modules must also handle cold-start deep links that arrive before the JS bridge is ready.

### 4. Secure Storage

Session persistence requires platform-specific secure storage:

- **iOS**: Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- **Android**: Keystore with `setUserAuthenticationRequired(true)` and `setUserAuthenticationValidityDurationSeconds()`

A unified `SecureStorage` abstraction in the native module should handle both platforms.

## Implementation Recommendations

1. **Start with TON Connect UI React** (`@tonconnect/ui-react`): For the initial `@t402/react-native` release, use the web-based TON Connect UI in a WebView or via React Native's in-app browser. This avoids native module complexity while still enabling TON payments.

2. **Add native modules incrementally**: Once the JS-layer payment flow is validated, create `@t402/react-native-ton` as a separate package containing the iOS and Android native modules. This keeps the core package lightweight.

3. **Use Turbo Modules**: Target React Native 0.72+ with New Architecture support. Turbo Modules provide type-safe native interfaces via CodeGen and faster bridge performance.

4. **Mirror the WDK pattern**: The `@t402/wdk` package already has a registration pattern (`T402WDK.registerWDK(WDK, { wallets: { ton: WalletManagerTon } })`). The React Native TON module should follow this pattern, allowing optional registration of the native signer.

5. **Test with Tonkeeper**: Tonkeeper is the most widely used TON wallet with excellent TON Connect v2 support. Use it as the primary test wallet for both iOS and Android during development.

6. **Handle offline/airplane mode**: Mobile apps frequently lose connectivity. The payment flow should handle network errors gracefully, with retry logic and clear user feedback in the `PaymentSheet` component.
