// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { T402ExactPermit2Proxy } from "../src/T402ExactPermit2Proxy.sol";
import { T402UptoPermit2Proxy } from "../src/T402UptoPermit2Proxy.sol";

/// @title DeployPermit2Proxies
/// @notice Deploys both T402 Permit2 proxy contracts via CREATE2
/// @dev The canonical Permit2 address is the same on all EVM chains:
///      0x000000000022D473030F116dDEE9F6B43aC78BA3
///
/// Usage:
///   forge script DeployPermit2Proxy.s.sol:DeployPermit2Proxies \
///     --rpc-url $RPC_URL --private-key $KEY --broadcast --verify
contract DeployPermit2Proxies is Script {
    /// @notice Canonical Uniswap Permit2 address (same on all EVM chains)
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    /// @notice Keyless CREATE2 deployer (available on all EVM chains)
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @notice Deterministic salts for proxy deployment
    bytes32 constant EXACT_SALT = keccak256("t402-exact-permit2-proxy-v1");
    bytes32 constant UPTO_SALT = keccak256("t402-upto-permit2-proxy-v1");

    function run() external {
        console2.log("Chain ID:", block.chainid);
        console2.log("Permit2:", PERMIT2);

        // Compute expected addresses
        address expectedExact = _computeCreate2Address(
            EXACT_SALT,
            abi.encodePacked(type(T402ExactPermit2Proxy).creationCode, abi.encode(PERMIT2))
        );
        address expectedUpto = _computeCreate2Address(
            UPTO_SALT,
            abi.encodePacked(type(T402UptoPermit2Proxy).creationCode, abi.encode(PERMIT2))
        );

        console2.log("Expected ExactPermit2Proxy:", expectedExact);
        console2.log("Expected UptoPermit2Proxy:", expectedUpto);

        // Skip if already deployed
        if (expectedExact.code.length > 0 && expectedUpto.code.length > 0) {
            console2.log("Both proxies already deployed - skipping");
            return;
        }

        vm.startBroadcast();

        // For local testnets (Anvil), use regular deployment since CREATE2 deployer
        // may not be available
        if (block.chainid == 31337 || block.chainid == 1337) {
            T402ExactPermit2Proxy exact = new T402ExactPermit2Proxy(PERMIT2);
            T402UptoPermit2Proxy upto = new T402UptoPermit2Proxy(PERMIT2);
            console2.log("ExactPermit2Proxy (local):", address(exact));
            console2.log("UptoPermit2Proxy (local):", address(upto));
        } else {
            // CREATE2 deployment for deterministic addresses
            if (expectedExact.code.length == 0) {
                bytes memory exactInitCode =
                    abi.encodePacked(type(T402ExactPermit2Proxy).creationCode, abi.encode(PERMIT2));
                (bool ok,) = CREATE2_DEPLOYER.call(abi.encodePacked(EXACT_SALT, exactInitCode));
                require(ok, "ExactPermit2Proxy CREATE2 failed");
                require(expectedExact.code.length > 0, "ExactPermit2Proxy not at expected address");
                console2.log("ExactPermit2Proxy deployed:", expectedExact);
            }

            if (expectedUpto.code.length == 0) {
                bytes memory uptoInitCode =
                    abi.encodePacked(type(T402UptoPermit2Proxy).creationCode, abi.encode(PERMIT2));
                (bool ok,) = CREATE2_DEPLOYER.call(abi.encodePacked(UPTO_SALT, uptoInitCode));
                require(ok, "UptoPermit2Proxy CREATE2 failed");
                require(expectedUpto.code.length > 0, "UptoPermit2Proxy not at expected address");
                console2.log("UptoPermit2Proxy deployed:", expectedUpto);
            }
        }

        vm.stopBroadcast();
    }

    function _computeCreate2Address(bytes32 salt, bytes memory initCode)
        internal
        pure
        returns (address)
    {
        return address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), CREATE2_DEPLOYER, salt, keccak256(initCode))))
            )
        );
    }
}

/// @title DeployPermit2ProxiesTestnet
/// @notice Testnet deployment with env-based configuration
contract DeployPermit2ProxiesTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address permit2 = vm.envOr("PERMIT2_ADDRESS", address(0x000000000022D473030F116dDEE9F6B43aC78BA3));

        console2.log("Deploying to testnet...");
        console2.log("Permit2:", permit2);

        vm.startBroadcast(deployerPrivateKey);

        T402ExactPermit2Proxy exact = new T402ExactPermit2Proxy(permit2);
        T402UptoPermit2Proxy upto = new T402UptoPermit2Proxy(permit2);

        vm.stopBroadcast();

        console2.log("ExactPermit2Proxy:", address(exact));
        console2.log("UptoPermit2Proxy:", address(upto));
    }
}
