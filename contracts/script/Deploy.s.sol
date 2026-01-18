// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {T402UptoRouter} from "../src/T402UptoRouter.sol";

/// @title DeployT402UptoRouter
/// @notice Deployment script for T402UptoRouter contract
/// @dev Use with: forge script Deploy.s.sol --private-key $KEY --broadcast
contract DeployT402UptoRouter is Script {
    // T402 Facilitator address (same across all EVM chains)
    address constant FACILITATOR = 0xC88f67e776f16DcFBf42e6bDda1B82604448899B;

    function run() external returns (T402UptoRouter router) {
        console2.log("Facilitator:", FACILITATOR);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast();

        router = new T402UptoRouter(FACILITATOR);

        vm.stopBroadcast();

        console2.log("T402UptoRouter deployed at:", address(router));
        console2.log("Owner:", router.owner());
        console2.log("Facilitator count:", router.facilitatorCount());

        // Verify deployment
        require(router.isFacilitator(FACILITATOR), "Facilitator not set");
    }
}

/// @title DeployTestnet
/// @notice Deployment script for testnet with custom facilitator
contract DeployTestnet is Script {
    function run() external returns (T402UptoRouter router) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address facilitator = vm.envAddress("FACILITATOR_ADDRESS");

        console2.log("Deploying to testnet...");
        console2.log("Facilitator:", facilitator);

        vm.startBroadcast(deployerPrivateKey);

        router = new T402UptoRouter(facilitator);

        vm.stopBroadcast();

        console2.log("T402UptoRouter deployed at:", address(router));
    }
}
