"""
WDK Signer implementation for T402 payments.

This module provides a Python implementation of the T402 WDK signer,
supporting multi-chain wallets derived from a BIP-39 seed phrase.
"""

from typing import Optional, Dict, List, Union
from eth_account import Account
from eth_account.messages import encode_typed_data, encode_defunct
from eth_account.hdaccount import generate_mnemonic
from web3 import Web3

from .types import (
    ChainConfig,
    TokenBalance,
    ChainBalance,
    AggregatedBalance,
    PaymentParams,
    PaymentResult,
    SignedTypedData,
    NetworkType,
)
from .chains import (
    DEFAULT_CHAINS,
    USDT0_ADDRESSES,
    USDC_ADDRESSES,
    get_chain_config,
    get_chain_tokens,
)
from .errors import (
    WDKErrorCode,
    WDKInitializationError,
    SignerError,
    SigningError,
    BalanceError,
    ChainError,
)


# ERC20 ABI for balance checks
ERC20_BALANCE_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    }
]


def generate_seed_phrase(strength: int = 128) -> str:
    """
    Generate a new BIP-39 mnemonic seed phrase.

    Args:
        strength: Entropy strength in bits (128 for 12 words, 256 for 24 words)

    Returns:
        A new mnemonic seed phrase
    """
    return generate_mnemonic(num_words=12 if strength <= 128 else 24, lang="english")


def validate_seed_phrase(seed_phrase: str) -> bool:
    """
    Validate a BIP-39 seed phrase.

    Args:
        seed_phrase: The mnemonic to validate

    Returns:
        True if valid, False otherwise
    """
    words = seed_phrase.strip().split()
    return len(words) in [12, 15, 18, 21, 24]


class WDKSigner:
    """
    WDK Signer for T402 payments.

    Provides wallet functionality derived from a BIP-39 seed phrase,
    with support for EVM chains, signing, and balance checking.

    Example:
        ```python
        from t402.wdk import WDKSigner

        # Create signer from seed phrase
        signer = WDKSigner(
            seed_phrase="your twelve word seed phrase here",
            chains={"arbitrum": "https://arb1.arbitrum.io/rpc"}
        )
        await signer.initialize()

        # Get EVM address
        address = signer.get_address("evm")

        # Sign typed data for T402 payment
        signature = await signer.sign_typed_data(typed_data, "arbitrum")
        ```
    """

    def __init__(
        self,
        seed_phrase: str,
        chains: Optional[Dict[str, str]] = None,
        account_index: int = 0,
        timeout: int = 30,
    ):
        """
        Create a new WDK signer.

        Args:
            seed_phrase: BIP-39 mnemonic seed phrase
            chains: Dictionary of chain name -> RPC URL
            account_index: HD wallet account index (default: 0)
            timeout: Operation timeout in seconds
        """
        if not seed_phrase or not isinstance(seed_phrase, str):
            raise WDKInitializationError(
                "Seed phrase is required and must be a string",
                code=WDKErrorCode.INVALID_SEED_PHRASE,
            )

        if not validate_seed_phrase(seed_phrase):
            raise WDKInitializationError(
                "Invalid seed phrase: expected 12, 15, 18, 21, or 24 words",
                code=WDKErrorCode.INVALID_SEED_PHRASE,
            )

        self._seed_phrase = seed_phrase
        self._account_index = account_index
        self._timeout = timeout
        self._initialized = False

        # EVM account derived from seed
        self._evm_account: Optional[Account] = None
        self._evm_address: Optional[str] = None

        # Web3 instances per chain
        self._web3_instances: Dict[str, Web3] = {}

        # Configure chains
        self._chains: Dict[str, ChainConfig] = {}
        if chains:
            for chain_name, rpc_url in chains.items():
                base_config = get_chain_config(chain_name)
                if base_config:
                    self._chains[chain_name] = ChainConfig(
                        chain_id=base_config.chain_id,
                        network=base_config.network,
                        name=chain_name,
                        rpc_url=rpc_url,
                        network_type=base_config.network_type,
                    )
                else:
                    # Allow custom chains
                    self._chains[chain_name] = ChainConfig(
                        chain_id=1,
                        network="eip155:1",
                        name=chain_name,
                        rpc_url=rpc_url,
                        network_type=NetworkType.EVM,
                    )

        # Add default chain if none configured
        if not self._chains:
            default = DEFAULT_CHAINS.get("arbitrum")
            if default:
                self._chains["arbitrum"] = default

    async def initialize(self) -> None:
        """
        Initialize the signer by deriving accounts from the seed phrase.

        Must be called before using signing operations.
        """
        if self._initialized:
            return

        try:
            # Enable HD wallet features
            Account.enable_unaudited_hdwallet_features()

            # Derive EVM account from seed phrase
            self._evm_account = Account.from_mnemonic(
                self._seed_phrase,
                account_path=f"m/44'/60'/0'/0/{self._account_index}",
            )
            self._evm_address = self._evm_account.address

            # Initialize Web3 instances for each chain
            for chain_name, config in self._chains.items():
                if config.network_type == NetworkType.EVM:
                    self._web3_instances[chain_name] = Web3(
                        Web3.HTTPProvider(config.rpc_url)
                    )

            self._initialized = True
        except Exception as e:
            raise WDKInitializationError(
                f"Failed to initialize signer: {str(e)}",
                cause=e,
            )

    def _ensure_initialized(self) -> None:
        """Ensure the signer is initialized."""
        if not self._initialized:
            raise SignerError(
                WDKErrorCode.SIGNER_NOT_INITIALIZED,
                "Signer not initialized. Call initialize() first.",
            )

    @property
    def is_initialized(self) -> bool:
        """Check if the signer is initialized."""
        return self._initialized

    def get_address(self, network_type: str = "evm") -> Optional[str]:
        """
        Get wallet address for a network type.

        Args:
            network_type: Network type ("evm", "solana", "ton", "tron")

        Returns:
            The wallet address or None if not supported
        """
        self._ensure_initialized()

        network_type = network_type.lower()
        if network_type == "evm":
            return self._evm_address
        # Solana, TON, TRON would need additional derivation
        # For now, only EVM is supported
        return None

    def get_configured_chains(self) -> List[str]:
        """Get list of configured chain names."""
        return list(self._chains.keys())

    def is_chain_configured(self, chain: str) -> bool:
        """Check if a chain is configured."""
        return chain in self._chains

    def get_chain_config(self, chain: str) -> Optional[ChainConfig]:
        """Get configuration for a chain."""
        return self._chains.get(chain)

    async def sign_typed_data(
        self,
        typed_data: SignedTypedData,
        chain: Optional[str] = None,
    ) -> str:
        """
        Sign EIP-712 typed data.

        This is the primary signing method used for T402 EIP-3009 payments.

        Args:
            typed_data: The typed data to sign
            chain: Optional chain name (for context, not required for signing)

        Returns:
            The signature as a hex string

        Raises:
            SigningError: If signing fails
        """
        self._ensure_initialized()

        if not typed_data or not isinstance(typed_data, SignedTypedData):
            raise SigningError(
                WDKErrorCode.INVALID_TYPED_DATA,
                "Invalid typed data: SignedTypedData object is required",
                operation="sign_typed_data",
                chain=chain,
            )

        if not all([typed_data.domain, typed_data.types, typed_data.primary_type, typed_data.message]):
            raise SigningError(
                WDKErrorCode.INVALID_TYPED_DATA,
                "Invalid typed data: domain, types, primary_type, and message are required",
                operation="sign_typed_data",
                chain=chain,
            )

        try:
            # Encode the typed data
            encoded = encode_typed_data(
                domain_data=typed_data.domain,
                message_types=typed_data.types,
                message_data=typed_data.message,
            )

            # Sign with the EVM account
            signed = self._evm_account.sign_message(encoded)

            return signed.signature.hex()
        except Exception as e:
            raise SigningError(
                WDKErrorCode.SIGN_TYPED_DATA_FAILED,
                f"Failed to sign typed data: {str(e)}",
                operation="sign_typed_data",
                chain=chain,
                cause=e,
            )

    async def sign_message(self, message: Union[str, bytes], chain: Optional[str] = None) -> str:
        """
        Sign a personal message.

        Args:
            message: The message to sign (string or bytes)
            chain: Optional chain name (for context)

        Returns:
            The signature as a hex string

        Raises:
            SigningError: If signing fails
        """
        self._ensure_initialized()

        if message is None:
            raise SigningError(
                WDKErrorCode.INVALID_MESSAGE,
                "Message is required for signing",
                operation="sign_message",
                chain=chain,
            )

        try:
            # Convert bytes to string if needed
            if isinstance(message, bytes):
                message = message.decode("utf-8")

            # Encode and sign
            encoded = encode_defunct(text=message)
            signed = self._evm_account.sign_message(encoded)

            return signed.signature.hex()
        except Exception as e:
            raise SigningError(
                WDKErrorCode.SIGN_MESSAGE_FAILED,
                f"Failed to sign message: {str(e)}",
                operation="sign_message",
                chain=chain,
                cause=e,
            )

    def _get_web3(self, chain: str) -> Web3:
        """Get Web3 instance for a chain."""
        if chain not in self._web3_instances:
            config = self._chains.get(chain)
            if not config:
                raise ChainError(
                    WDKErrorCode.CHAIN_NOT_CONFIGURED,
                    f"Chain '{chain}' not configured",
                    chain=chain,
                )
            self._web3_instances[chain] = Web3(Web3.HTTPProvider(config.rpc_url))
        return self._web3_instances[chain]

    async def get_balance(self, chain: str) -> int:
        """
        Get native token balance (ETH, etc.) for a chain.

        Args:
            chain: Chain name

        Returns:
            Balance in wei

        Raises:
            BalanceError: If balance fetch fails
        """
        self._ensure_initialized()

        try:
            web3 = self._get_web3(chain)
            balance = web3.eth.get_balance(self._evm_address)
            return balance
        except ChainError:
            raise
        except Exception as e:
            raise BalanceError(
                WDKErrorCode.BALANCE_FETCH_FAILED,
                f"Failed to get native balance for {chain}: {str(e)}",
                chain=chain,
                cause=e,
            )

    async def get_token_balance(self, chain: str, token_address: str) -> int:
        """
        Get ERC20 token balance.

        Args:
            chain: Chain name
            token_address: Token contract address

        Returns:
            Token balance in smallest units

        Raises:
            BalanceError: If balance fetch fails
        """
        self._ensure_initialized()

        if not token_address or not token_address.startswith("0x"):
            raise BalanceError(
                WDKErrorCode.INVALID_TOKEN_ADDRESS,
                f"Invalid token address: {token_address}",
                chain=chain,
                token=token_address,
            )

        try:
            web3 = self._get_web3(chain)
            contract = web3.eth.contract(
                address=Web3.to_checksum_address(token_address),
                abi=ERC20_BALANCE_ABI,
            )
            balance = contract.functions.balanceOf(self._evm_address).call()
            return balance
        except ChainError:
            raise
        except Exception as e:
            raise BalanceError(
                WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED,
                f"Failed to get token balance for {token_address} on {chain}: {str(e)}",
                chain=chain,
                token=token_address,
                cause=e,
            )

    async def get_usdt0_balance(self, chain: str) -> int:
        """
        Get USDT0 balance for a chain.

        Args:
            chain: Chain name

        Returns:
            USDT0 balance in smallest units (6 decimals)
        """
        usdt0_address = USDT0_ADDRESSES.get(chain)
        if not usdt0_address:
            return 0

        try:
            return await self.get_token_balance(chain, usdt0_address)
        except BalanceError:
            return 0

    async def get_usdc_balance(self, chain: str) -> int:
        """
        Get USDC balance for a chain.

        Args:
            chain: Chain name

        Returns:
            USDC balance in smallest units (6 decimals)
        """
        usdc_address = USDC_ADDRESSES.get(chain)
        if not usdc_address:
            return 0

        try:
            return await self.get_token_balance(chain, usdc_address)
        except BalanceError:
            return 0

    async def get_chain_balances(self, chain: str) -> ChainBalance:
        """
        Get all token balances for a chain.

        Args:
            chain: Chain name

        Returns:
            ChainBalance with native and token balances
        """
        self._ensure_initialized()

        config = self._chains.get(chain)
        if not config:
            raise ChainError(
                WDKErrorCode.CHAIN_NOT_CONFIGURED,
                f"Chain '{chain}' not configured",
                chain=chain,
            )

        try:
            # Get native balance
            native_balance = await self.get_balance(chain)

            # Get token balances
            tokens = get_chain_tokens(chain)
            token_balances: List[TokenBalance] = []

            for token in tokens:
                try:
                    balance = await self.get_token_balance(chain, token.address)
                    token_balances.append(
                        TokenBalance(
                            token=token.address,
                            symbol=token.symbol,
                            balance=balance,
                            formatted=format_token_amount(balance, token.decimals),
                            decimals=token.decimals,
                        )
                    )
                except BalanceError:
                    # Add zero balance for failed fetches
                    token_balances.append(
                        TokenBalance(
                            token=token.address,
                            symbol=token.symbol,
                            balance=0,
                            formatted="0",
                            decimals=token.decimals,
                        )
                    )

            return ChainBalance(
                chain=chain,
                network=config.network,
                native=native_balance,
                tokens=token_balances,
            )
        except ChainError:
            raise
        except Exception as e:
            raise BalanceError(
                WDKErrorCode.BALANCE_FETCH_FAILED,
                f"Failed to get balances for {chain}: {str(e)}",
                chain=chain,
                cause=e,
            )

    async def get_all_balances(self) -> Dict[str, int]:
        """
        Get USDT0/USDC balances for all configured chains.

        Returns:
            Dictionary of network -> balance
        """
        self._ensure_initialized()

        balances: Dict[str, int] = {}

        for chain_name, config in self._chains.items():
            try:
                # Try USDT0 first, then USDC
                usdt0_balance = await self.get_usdt0_balance(chain_name)
                if usdt0_balance > 0:
                    balances[config.network] = usdt0_balance
                else:
                    usdc_balance = await self.get_usdc_balance(chain_name)
                    balances[config.network] = usdc_balance
            except Exception:
                balances[config.network] = 0

        return balances

    async def get_aggregated_balances(
        self, continue_on_error: bool = True
    ) -> AggregatedBalance:
        """
        Get aggregated balances across all configured chains.

        Args:
            continue_on_error: If True, continue even if some chains fail

        Returns:
            AggregatedBalance with totals and per-chain breakdown
        """
        self._ensure_initialized()

        chain_balances: List[ChainBalance] = []
        total_usdt0 = 0
        total_usdc = 0

        for chain_name in self._chains:
            try:
                chain_balance = await self.get_chain_balances(chain_name)
                chain_balances.append(chain_balance)

                # Sum up totals
                for token in chain_balance.tokens:
                    if token.symbol == "USDT0":
                        total_usdt0 += token.balance
                    elif token.symbol == "USDC":
                        total_usdc += token.balance
            except Exception:
                if not continue_on_error:
                    raise
                # Add empty balance for failed chain
                config = self._chains.get(chain_name)
                if config:
                    chain_balances.append(
                        ChainBalance(
                            chain=chain_name,
                            network=config.network,
                            native=0,
                            tokens=[],
                        )
                    )

        return AggregatedBalance(
            total_usdt0=total_usdt0,
            total_usdc=total_usdc,
            chains=chain_balances,
        )

    async def pay(self, params: PaymentParams) -> PaymentResult:
        """
        Execute a payment.

        Note: This is a placeholder for direct payment functionality.
        For T402 payments, use sign_typed_data() with the payment authorization.

        Args:
            params: Payment parameters

        Returns:
            PaymentResult with transaction hash or error
        """
        self._ensure_initialized()

        # For now, return an error indicating to use T402 payment flow
        return PaymentResult(
            success=False,
            error="Direct payments not implemented. Use sign_typed_data() for T402 payments.",
        )


def format_token_amount(amount: int, decimals: int) -> str:
    """Format token amount for display."""
    if amount == 0:
        return "0"

    divisor = 10**decimals
    whole = amount // divisor
    fraction = amount % divisor

    if fraction == 0:
        return str(whole)

    # Format fraction and trim trailing zeros
    fraction_str = str(fraction).zfill(decimals).rstrip("0")
    return f"{whole}.{fraction_str}"
