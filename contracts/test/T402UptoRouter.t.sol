// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {T402UptoRouter} from "../src/T402UptoRouter.sol";
import {IT402UptoRouter} from "../src/interfaces/IT402UptoRouter.sol";
import {MockERC20Permit} from "./mocks/MockERC20Permit.sol";

contract T402UptoRouterTest is Test {
    T402UptoRouter public router;
    MockERC20Permit public token;

    address public owner;
    address public facilitator;
    address public payer;
    address public recipient;
    uint256 public payerPrivateKey;

    uint256 constant INITIAL_BALANCE = 1_000_000e6; // 1M USDC
    uint256 constant MAX_AMOUNT = 100e6; // 100 USDC
    uint256 constant SETTLE_AMOUNT = 50e6; // 50 USDC

    function setUp() public {
        owner = address(this);
        facilitator = makeAddr("facilitator");
        recipient = makeAddr("recipient");

        // Create payer with known private key for signing
        payerPrivateKey = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef;
        payer = vm.addr(payerPrivateKey);

        // Deploy contracts
        router = new T402UptoRouter(facilitator);
        token = new MockERC20Permit("USD Coin", "USDC", 6);

        // Fund payer
        token.mint(payer, INITIAL_BALANCE);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_constructor_setsOwner() public view {
        assertEq(router.owner(), owner);
    }

    function test_constructor_setsFacilitator() public view {
        assertTrue(router.isFacilitator(facilitator));
        assertEq(router.facilitatorCount(), 1);
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(T402UptoRouter.ZeroAddress.selector);
        new T402UptoRouter(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                        EXECUTE TRANSFER TESTS
    //////////////////////////////////////////////////////////////*/

    function test_executeUptoTransfer_success() public {
        uint256 deadline = block.timestamp + 1 hours;

        // Create permit signature
        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        // Execute as facilitator
        vm.prank(facilitator);
        router.executeUptoTransfer(
            address(token),
            payer,
            recipient,
            MAX_AMOUNT,
            SETTLE_AMOUNT,
            deadline,
            v,
            r,
            s
        );

        // Verify transfer
        assertEq(token.balanceOf(recipient), SETTLE_AMOUNT);
        assertEq(token.balanceOf(payer), INITIAL_BALANCE - SETTLE_AMOUNT);
    }

    function test_executeUptoTransfer_partialAmount() public {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 partialAmount = 10e6; // Only 10 USDC

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        vm.prank(facilitator);
        router.executeUptoTransfer(
            address(token),
            payer,
            recipient,
            MAX_AMOUNT,
            partialAmount,
            deadline,
            v,
            r,
            s
        );

        assertEq(token.balanceOf(recipient), partialAmount);
    }

    function test_executeUptoTransfer_emitsEvent() public {
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        vm.expectEmit(true, true, true, true);
        emit IT402UptoRouter.TransferExecuted(
            address(token),
            payer,
            recipient,
            SETTLE_AMOUNT,
            MAX_AMOUNT
        );

        vm.prank(facilitator);
        router.executeUptoTransfer(
            address(token),
            payer,
            recipient,
            MAX_AMOUNT,
            SETTLE_AMOUNT,
            deadline,
            v,
            r,
            s
        );
    }

    function test_executeUptoTransfer_revertsOnUnauthorized() public {
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        address unauthorized = makeAddr("unauthorized");
        vm.expectRevert(
            abi.encodeWithSelector(T402UptoRouter.UnauthorizedFacilitator.selector, unauthorized)
        );

        vm.prank(unauthorized);
        router.executeUptoTransfer(
            address(token),
            payer,
            recipient,
            MAX_AMOUNT,
            SETTLE_AMOUNT,
            deadline,
            v,
            r,
            s
        );
    }

    function test_executeUptoTransfer_revertsOnSettleExceedsMax() public {
        uint256 deadline = block.timestamp + 1 hours;
        uint256 excessAmount = MAX_AMOUNT + 1;

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                T402UptoRouter.SettleAmountExceedsMax.selector,
                excessAmount,
                MAX_AMOUNT
            )
        );

        vm.prank(facilitator);
        router.executeUptoTransfer(
            address(token),
            payer,
            recipient,
            MAX_AMOUNT,
            excessAmount,
            deadline,
            v,
            r,
            s
        );
    }

    function test_executeUptoTransfer_revertsOnZeroAmount() public {
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        vm.expectRevert(T402UptoRouter.ZeroAmount.selector);

        vm.prank(facilitator);
        router.executeUptoTransfer(
            address(token),
            payer,
            recipient,
            MAX_AMOUNT,
            0,
            deadline,
            v,
            r,
            s
        );
    }

    function test_executeUptoTransfer_revertsOnExpiredDeadline() public {
        uint256 deadline = block.timestamp - 1; // Already expired

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                T402UptoRouter.PermitExpired.selector,
                deadline,
                block.timestamp
            )
        );

        vm.prank(facilitator);
        router.executeUptoTransfer(
            address(token),
            payer,
            recipient,
            MAX_AMOUNT,
            SETTLE_AMOUNT,
            deadline,
            v,
            r,
            s
        );
    }

    function test_executeUptoTransfer_revertsOnZeroAddress() public {
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        vm.expectRevert(T402UptoRouter.ZeroAddress.selector);

        vm.prank(facilitator);
        router.executeUptoTransfer(
            address(0), // Zero token address
            payer,
            recipient,
            MAX_AMOUNT,
            SETTLE_AMOUNT,
            deadline,
            v,
            r,
            s
        );
    }

    /*//////////////////////////////////////////////////////////////
                      FACILITATOR MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_addFacilitator_success() public {
        address newFacilitator = makeAddr("newFacilitator");

        vm.expectEmit(true, false, false, false);
        emit IT402UptoRouter.FacilitatorAdded(newFacilitator);

        router.addFacilitator(newFacilitator);

        assertTrue(router.isFacilitator(newFacilitator));
        assertEq(router.facilitatorCount(), 2);
    }

    function test_addFacilitator_revertsOnNonOwner() public {
        address newFacilitator = makeAddr("newFacilitator");
        address nonOwner = makeAddr("nonOwner");

        vm.expectRevert(
            abi.encodeWithSelector(T402UptoRouter.UnauthorizedOwner.selector, nonOwner)
        );

        vm.prank(nonOwner);
        router.addFacilitator(newFacilitator);
    }

    function test_addFacilitator_revertsOnDuplicate() public {
        vm.expectRevert(
            abi.encodeWithSelector(T402UptoRouter.FacilitatorAlreadyExists.selector, facilitator)
        );

        router.addFacilitator(facilitator);
    }

    function test_removeFacilitator_success() public {
        vm.expectEmit(true, false, false, false);
        emit IT402UptoRouter.FacilitatorRemoved(facilitator);

        router.removeFacilitator(facilitator);

        assertFalse(router.isFacilitator(facilitator));
        assertEq(router.facilitatorCount(), 0);
    }

    function test_removeFacilitator_revertsOnNonOwner() public {
        address nonOwner = makeAddr("nonOwner");

        vm.expectRevert(
            abi.encodeWithSelector(T402UptoRouter.UnauthorizedOwner.selector, nonOwner)
        );

        vm.prank(nonOwner);
        router.removeFacilitator(facilitator);
    }

    function test_removeFacilitator_revertsOnNonExistent() public {
        address nonFacilitator = makeAddr("nonFacilitator");

        vm.expectRevert(
            abi.encodeWithSelector(T402UptoRouter.FacilitatorDoesNotExist.selector, nonFacilitator)
        );

        router.removeFacilitator(nonFacilitator);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_checkPermitValidity_validBalance() public view {
        (bool valid, uint256 balance) = router.checkPermitValidity(
            address(token),
            payer,
            MAX_AMOUNT
        );

        assertTrue(valid);
        assertEq(balance, INITIAL_BALANCE);
    }

    function test_checkPermitValidity_insufficientBalance() public view {
        (bool valid, uint256 balance) = router.checkPermitValidity(
            address(token),
            payer,
            INITIAL_BALANCE + 1
        );

        assertFalse(valid);
        assertEq(balance, INITIAL_BALANCE);
    }

    function test_getPermitNonce() public view {
        uint256 nonce = router.getPermitNonce(address(token), payer);
        assertEq(nonce, 0);
    }

    function test_getDomainSeparator() public view {
        bytes32 separator = router.getDomainSeparator(address(token));
        assertEq(separator, token.DOMAIN_SEPARATOR());
    }

    /*//////////////////////////////////////////////////////////////
                             FUZZ TESTS
    //////////////////////////////////////////////////////////////*/

    function testFuzz_executeUptoTransfer_settleAmount(uint256 settleAmount) public {
        settleAmount = bound(settleAmount, 1, MAX_AMOUNT);
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v, bytes32 r, bytes32 s) = _createPermitSignature(
            payer,
            payerPrivateKey,
            address(router),
            MAX_AMOUNT,
            deadline
        );

        vm.prank(facilitator);
        router.executeUptoTransfer(
            address(token),
            payer,
            recipient,
            MAX_AMOUNT,
            settleAmount,
            deadline,
            v,
            r,
            s
        );

        assertEq(token.balanceOf(recipient), settleAmount);
    }

    /*//////////////////////////////////////////////////////////////
                              HELPERS
    //////////////////////////////////////////////////////////////*/

    function _createPermitSignature(
        address _owner,
        uint256 _privateKey,
        address _spender,
        uint256 _value,
        uint256 _deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                _owner,
                _spender,
                _value,
                token.nonces(_owner),
                _deadline
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)
        );

        (v, r, s) = vm.sign(_privateKey, digest);
    }
}
