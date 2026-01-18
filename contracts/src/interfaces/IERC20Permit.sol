// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title IERC20Permit
/// @notice Interface for ERC20 tokens with EIP-2612 permit functionality
interface IERC20Permit {
    /// @notice Approve spender via signature (EIP-2612)
    /// @param owner The token owner
    /// @param spender The approved spender
    /// @param value The approved amount
    /// @param deadline The signature deadline
    /// @param v Signature v component
    /// @param r Signature r component
    /// @param s Signature s component
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice Transfer tokens from one address to another
    /// @param from The sender address
    /// @param to The recipient address
    /// @param amount The amount to transfer
    /// @return True if successful
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /// @notice Get the current nonce for an address
    /// @param owner The address to check
    /// @return The current nonce
    function nonces(address owner) external view returns (uint256);

    /// @notice Get the domain separator for EIP-712
    /// @return The domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Get the allowance for a spender
    /// @param owner The token owner
    /// @param spender The spender address
    /// @return The current allowance
    function allowance(address owner, address spender) external view returns (uint256);

    /// @notice Get the balance of an address
    /// @param account The address to check
    /// @return The balance
    function balanceOf(address account) external view returns (uint256);
}
