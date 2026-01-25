"""
Constants for T402 Multi-sig (Safe) support.

Safe 4337 module addresses (v0.3.0) deployed on all major EVM chains.
"""

# Safe 4337 Module address
SAFE_4337_MODULE = "0xa581c4A4DB7175302464fF3C06380BC3270b4037"

# Safe Module Setup address
SAFE_MODULE_SETUP = "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47"

# Safe Singleton address
SAFE_SINGLETON = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762"

# Safe Proxy Factory address
SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67"

# Safe Fallback Handler address
SAFE_FALLBACK_HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99"

# Add Modules Lib address
SAFE_ADD_MODULES_LIB = "0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb"

# MultiSend library address
SAFE_MULTISEND = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526"

# ERC-4337 EntryPoint v0.7 address
ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

# Default configuration values
DEFAULT_REQUEST_EXPIRATION_SECONDS = 3600  # 1 hour
DEFAULT_SALT_NONCE = 0
MAX_OWNERS = 10
MIN_THRESHOLD = 1

# Safe ABI method selectors (function selectors)
GET_OWNERS_SELECTOR = bytes.fromhex("a0e67e2b")
GET_THRESHOLD_SELECTOR = bytes.fromhex("e75b2357")
NONCE_SELECTOR = bytes.fromhex("affed0e0")
EXEC_TRANSACTION_SELECTOR = bytes.fromhex("6a761202")
GET_TRANSACTION_HASH_SELECTOR = bytes.fromhex("d8d11f78")

# EIP-712 domain type hash for Safe
SAFE_DOMAIN_SEPARATOR_TYPEHASH = "EIP712Domain(uint256 chainId,address verifyingContract)"

# Safe transaction type hash
SAFE_TX_TYPEHASH = "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"

# ERC20 transfer selector
ERC20_TRANSFER_SELECTOR = bytes.fromhex("a9059cbb")

# MultiSend selector
MULTISEND_SELECTOR = bytes.fromhex("8d80ff0a")
