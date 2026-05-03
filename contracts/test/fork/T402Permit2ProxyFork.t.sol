// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { T402ExactPermit2Proxy } from "../../src/T402ExactPermit2Proxy.sol";
import { T402UptoPermit2Proxy } from "../../src/T402UptoPermit2Proxy.sol";
import { T402BasePermit2Proxy, IPermit2 } from "../../src/T402BasePermit2Proxy.sol";
import { IERC20Permit } from "../../src/interfaces/IERC20Permit.sol";

/// @title T402Permit2ProxyFork
/// @notice Fork tests against Base mainnet with real Permit2 and USDC
contract T402Permit2ProxyForkTest is Test {
    // Base mainnet constants
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    T402ExactPermit2Proxy public exactProxy;
    T402UptoPermit2Proxy public uptoProxy;

    address public facilitator;
    uint256 public facilitatorKey;
    address public payer;
    uint256 public payerKey;
    address public recipient;

    uint256 constant AMOUNT = 1000e6; // 1000 USDC (6 decimals)

    // Permit2 EIP-712 constants
    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 private constant _NAME_HASH = keccak256("Permit2");

    bytes32 private constant _PERMIT_WITNESS_TRANSFER_FROM_TYPEHASH = keccak256(
        "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)"
    );

    bytes32 private constant _TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");

    bytes32 private constant _WITNESS_TYPEHASH =
        keccak256("Witness(address to,address facilitator,uint256 validAfter)");

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));

        // Create accounts
        (facilitator, facilitatorKey) = makeAddrAndKey("facilitator");
        (payer, payerKey) = makeAddrAndKey("payer");
        recipient = makeAddr("recipient");

        // Deploy proxies using real Permit2
        exactProxy = new T402ExactPermit2Proxy(PERMIT2);
        uptoProxy = new T402UptoPermit2Proxy(PERMIT2);

        // Fund payer with USDC using deal cheatcode
        deal(USDC, payer, 100_000e6);

        // Payer approves Permit2 to spend USDC
        vm.prank(payer);
        (bool ok,) = USDC.call(
            abi.encodeWithSignature("approve(address,uint256)", PERMIT2, type(uint256).max)
        );
        require(ok, "approve failed");
    }

    /*//////////////////////////////////////////////////////////////
                        EXACT PROXY FORK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_fork_exactProxy_settle() public {
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 3600;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: AMOUNT }),
            nonce: nonce,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(payerKey, permit, address(exactProxy), witness);

        uint256 payerBefore = IERC20Permit(USDC).balanceOf(payer);
        uint256 recipientBefore = IERC20Permit(USDC).balanceOf(recipient);

        vm.prank(facilitator);
        exactProxy.settle(permit, payer, witness, sig);

        assertEq(IERC20Permit(USDC).balanceOf(payer), payerBefore - AMOUNT);
        assertEq(IERC20Permit(USDC).balanceOf(recipient), recipientBefore + AMOUNT);
        assertEq(IERC20Permit(USDC).balanceOf(address(exactProxy)), 0);
    }

    function test_fork_exactProxy_settleEmitsEvent() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(payerKey, permit, address(exactProxy), witness);

        vm.expectEmit(true, true, true, true);
        emit T402BasePermit2Proxy.Settled(USDC, payer, recipient, AMOUNT, facilitator);

        vm.prank(facilitator);
        exactProxy.settle(permit, payer, witness, sig);
    }

    function test_fork_exactProxy_nonceReplay() public {
        uint256 nonce = 42;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: AMOUNT }),
            nonce: nonce,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(payerKey, permit, address(exactProxy), witness);

        // First settle succeeds
        vm.prank(facilitator);
        exactProxy.settle(permit, payer, witness, sig);

        // Second settle with same nonce reverts (real Permit2 nonce check)
        vm.prank(facilitator);
        vm.expectRevert();
        exactProxy.settle(permit, payer, witness, sig);
    }

    function test_fork_exactProxy_expiredDeadline() public {
        uint256 deadline = block.timestamp - 1; // already expired

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: AMOUNT }),
            nonce: 0,
            deadline: deadline
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(payerKey, permit, address(exactProxy), witness);

        vm.prank(facilitator);
        vm.expectRevert();
        exactProxy.settle(permit, payer, witness, sig);
    }

    /*//////////////////////////////////////////////////////////////
                         UPTO PROXY FORK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_fork_uptoProxy_settlePartial() public {
        uint256 maxAmount = AMOUNT;
        uint256 settleAmount = 750e6;

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: maxAmount }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(uptoProxy), witness);

        uint256 payerBefore = IERC20Permit(USDC).balanceOf(payer);

        vm.prank(facilitator);
        uptoProxy.settle(permit, settleAmount, payer, witness, sig);

        assertEq(IERC20Permit(USDC).balanceOf(payer), payerBefore - settleAmount);
        assertEq(IERC20Permit(USDC).balanceOf(recipient), settleAmount);
        assertEq(IERC20Permit(USDC).balanceOf(address(uptoProxy)), 0);
    }

    function test_fork_uptoProxy_settleFull() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(uptoProxy), witness);

        vm.prank(facilitator);
        uptoProxy.settle(permit, AMOUNT, payer, witness, sig);

        assertEq(IERC20Permit(USDC).balanceOf(recipient), AMOUNT);
    }

    function test_fork_uptoProxy_amountExceedsPermitted() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig = _signPermitWitnessTransfer(payerKey, permit, address(uptoProxy), witness);

        vm.prank(facilitator);
        vm.expectRevert(T402UptoPermit2Proxy.AmountExceedsPermitted.selector);
        uptoProxy.settle(permit, AMOUNT + 1, payer, witness, sig);
    }

    /*//////////////////////////////////////////////////////////////
                     CROSS-PROXY FORK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_fork_multipleSettlements() public {
        // Exact settlement 1
        IPermit2.PermitTransferFrom memory permit1 = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: 100e6 }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness1 = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig1 =
            _signPermitWitnessTransfer(payerKey, permit1, address(exactProxy), witness1);

        vm.prank(facilitator);
        exactProxy.settle(permit1, payer, witness1, sig1);

        // Upto settlement 2 (different nonce)
        IPermit2.PermitTransferFrom memory permit2 = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: 500e6 }),
            nonce: 1,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness2 = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig2 =
            _signPermitWitnessTransfer(payerKey, permit2, address(uptoProxy), witness2);

        vm.prank(facilitator);
        uptoProxy.settle(permit2, 300e6, payer, witness2, sig2);

        // Verify cumulative balances
        assertEq(IERC20Permit(USDC).balanceOf(recipient), 100e6 + 300e6);
        assertEq(IERC20Permit(USDC).balanceOf(address(exactProxy)), 0);
        assertEq(IERC20Permit(USDC).balanceOf(address(uptoProxy)), 0);
    }

    function test_fork_unauthorizedFacilitator() public {
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        bytes memory sig =
            _signPermitWitnessTransfer(payerKey, permit, address(exactProxy), witness);

        address attacker = makeAddr("attacker");
        vm.prank(attacker);
        vm.expectRevert(T402BasePermit2Proxy.UnauthorizedFacilitator.selector);
        exactProxy.settle(permit, payer, witness, sig);
    }

    function test_fork_wrongSignerReverts() public {
        (, uint256 wrongKey) = makeAddrAndKey("wrongSigner");

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({ token: USDC, amount: AMOUNT }),
            nonce: 0,
            deadline: block.timestamp + 3600
        });

        T402BasePermit2Proxy.Witness memory witness = T402BasePermit2Proxy.Witness({
            to: recipient, facilitator: facilitator, validAfter: block.timestamp
        });

        // Sign with wrong key — Permit2 should reject
        bytes memory sig =
            _signPermitWitnessTransfer(wrongKey, permit, address(exactProxy), witness);

        vm.prank(facilitator);
        vm.expectRevert();
        exactProxy.settle(permit, payer, witness, sig);
    }

    /*//////////////////////////////////////////////////////////////
                          HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _signPermitWitnessTransfer(
        uint256 signerKey,
        IPermit2.PermitTransferFrom memory permit,
        address spender,
        T402BasePermit2Proxy.Witness memory witness
    ) internal view returns (bytes memory) {
        bytes32 domainSeparator = keccak256(
            abi.encode(_DOMAIN_TYPEHASH, _NAME_HASH, block.chainid, PERMIT2)
        );

        bytes32 witnessHash = keccak256(
            abi.encode(_WITNESS_TYPEHASH, witness.to, witness.facilitator, witness.validAfter)
        );

        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(_TOKEN_PERMISSIONS_TYPEHASH, permit.permitted.token, permit.permitted.amount)
        );

        bytes32 structHash = keccak256(
            abi.encode(
                _PERMIT_WITNESS_TRANSFER_FROM_TYPEHASH,
                tokenPermissionsHash,
                spender,
                permit.nonce,
                permit.deadline,
                witnessHash
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _approve(address token, address owner, address spender, uint256 amount) internal {
        vm.prank(owner);
        (bool success,) =
            token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
        require(success, "approve failed");
    }
}
