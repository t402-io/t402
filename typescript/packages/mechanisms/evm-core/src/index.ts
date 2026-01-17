/**
 * @t402/evm-core
 *
 * T402 EVM Core Types and Utilities
 *
 * This package provides EVM types, constants, and utilities with zero external dependencies
 * (except for @t402/core). Use this package when you want to work with T402 EVM types
 * without bundling viem.
 *
 * For full EVM functionality with viem integration, use @t402/evm instead.
 *
 * @packageDocumentation
 */

// Primitive types (Address, Hex, conversion functions)
export * from "./primitives";

// Payment types (ExactEIP3009Payload, UptoEIP2612Payload, etc.)
export * from "./types";

// EIP-712 and ABI constants
export * from "./constants";

// Signer interfaces
export * from "./signer";

// Token registry and configuration
export * from "./tokens";

// Utility functions
export * from "./utils";
