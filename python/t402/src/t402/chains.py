NETWORK_TO_ID = {
    # Standard networks
    "base-sepolia": "84532",
    "base": "8453",
    "avalanche-fuji": "43113",
    "avalanche": "43114",
    # Core USDT0 Networks
    "ethereum": "1",
    "arbitrum": "42161",
    "optimism": "10",
    "polygon": "137",
    "ink": "57073",
    "berachain": "80094",
    "unichain": "130",
    # Phase 1: High Priority USDT0 Networks
    "mantle": "5000",
    "plasma": "9745",
    "sei": "1329",
    "conflux": "1030",
    "monad": "143",
    # Phase 2: Medium Priority USDT0 Networks
    "flare": "14",
    "rootstock": "30",
    "xlayer": "196",
    "stable": "988",
    "hyperevm": "999",
    "megaeth": "4326",
    "corn": "21000000",
    # Legacy USDT Networks (no EIP-3009 support)
    "bnb": "56",
    "bsc": "56",
    "fantom": "250",
    "celo": "42220",
    "kaia": "8217",
    "klaytn": "8217",
}


def get_chain_id(network: str) -> str:
    """Get the chain ID for a given network
    Supports string encoded chain IDs and human readable networks
    """
    try:
        int(network)
        return network
    except ValueError:
        pass
    if network not in NETWORK_TO_ID:
        raise ValueError(f"Unsupported network: {network}")
    return NETWORK_TO_ID[network]


KNOWN_TOKENS = {
    # Base Sepolia (testnet)
    "84532": [
        {
            "human_name": "usdc",
            "address": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "name": "USDC",
            "decimals": 6,
            "version": "2",
        }
    ],
    # Base Mainnet
    "8453": [
        {
            "human_name": "usdc",
            "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "name": "USD Coin",
            "decimals": 6,
            "version": "2",
        }
    ],
    # Avalanche Fuji (testnet)
    "43113": [
        {
            "human_name": "usdc",
            "address": "0x5425890298aed601595a70AB815c96711a31Bc65",
            "name": "USD Coin",
            "decimals": 6,
            "version": "2",
        }
    ],
    # Avalanche Mainnet
    "43114": [
        {
            "human_name": "usdc",
            "address": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
            "name": "USDC",
            "decimals": 6,
            "version": "2",
        }
    ],
    # === USDT0 Networks ===
    # Ethereum Mainnet
    "1": [
        {
            "human_name": "usdt0",
            "address": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Arbitrum One
    "42161": [
        {
            "human_name": "usdt0",
            "address": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Optimism
    "10": [
        {
            "human_name": "usdt0",
            "address": "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Polygon
    "137": [
        {
            "human_name": "usdt0",
            "address": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Ink
    "57073": [
        {
            "human_name": "usdt0",
            "address": "0x0200C29006150606B650577BBE7B6248F58470c1",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Berachain
    "80094": [
        {
            "human_name": "usdt0",
            "address": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Unichain
    "130": [
        {
            "human_name": "usdt0",
            "address": "0x9151434b16b9763660705744891fA906F660EcC5",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Mantle
    "5000": [
        {
            "human_name": "usdt0",
            "address": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Plasma
    "9745": [
        {
            "human_name": "usdt0",
            "address": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Sei
    "1329": [
        {
            "human_name": "usdt0",
            "address": "0x9151434b16b9763660705744891fA906F660EcC5",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Conflux eSpace
    "1030": [
        {
            "human_name": "usdt0",
            "address": "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Monad
    "143": [
        {
            "human_name": "usdt0",
            "address": "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Flare
    "14": [
        {
            "human_name": "usdt0",
            "address": "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Rootstock
    "30": [
        {
            "human_name": "usdt0",
            "address": "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # XLayer
    "196": [
        {
            "human_name": "usdt0",
            "address": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Stable
    "988": [
        {
            "human_name": "usdt0",
            "address": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # HyperEVM
    "999": [
        {
            "human_name": "usdt0",
            "address": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # MegaETH
    "4326": [
        {
            "human_name": "usdt0",
            "address": "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Corn
    "21000000": [
        {
            "human_name": "usdt0",
            "address": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
            "name": "TetherToken",
            "decimals": 6,
            "version": "1",
        }
    ],
    # === Legacy USDT Networks (no EIP-3009 support) ===
    # BNB Chain (BSC)
    "56": [
        {
            "human_name": "usdt",
            "address": "0x55d398326f99059fF775485246999027B3197955",
            "name": "Tether USD",
            "decimals": 18,
            "version": "1",
        }
    ],
    # Avalanche C-Chain (already in KNOWN_TOKENS via "43114", add USDT)
    # Fantom
    "250": [
        {
            "human_name": "usdt",
            "address": "0x049d68029688eabf473097a2fc38ef61633a3c7a",
            "name": "Frapped USDT",
            "decimals": 6,
            "version": "1",
        }
    ],
    # Celo
    "42220": [
        {
            "human_name": "usdt",
            "address": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
            "name": "Tether USD",
            "decimals": 18,
            "version": "1",
        }
    ],
    # Kaia (formerly Klaytn)
    "8217": [
        {
            "human_name": "usdt",
            "address": "0xcee8faf64bb97a73bb51e115aa89c17ffa8dd167",
            "name": "Tether USD",
            "decimals": 6,
            "version": "1",
        }
    ],
}


def get_token_name(chain_id: str, address: str) -> str:
    """Get the token name for a given chain and address"""
    for token in KNOWN_TOKENS[chain_id]:
        if token["address"] == address:
            return token["name"]
    raise ValueError(f"Token not found for chain {chain_id} and address {address}")


def get_token_version(chain_id: str, address: str) -> str:
    """Get the token version for a given chain and address"""
    for token in KNOWN_TOKENS[chain_id]:
        if token["address"] == address:
            return token["version"]
    raise ValueError(f"Token not found for chain {chain_id} and address {address}")


def get_token_decimals(chain_id: str, address: str) -> int:
    """Get the token decimals for a given chain and address"""
    for token in KNOWN_TOKENS[chain_id]:
        if token["address"] == address:
            return token["decimals"]
    raise ValueError(f"Token not found for chain {chain_id} and address {address}")


def get_default_token_address(chain_id: str, token_type: str = "usdc") -> str:
    """Get the default token address for a given chain and token type"""
    for token in KNOWN_TOKENS[chain_id]:
        if token["human_name"] == token_type:
            return token["address"]
    raise ValueError(f"Token type '{token_type}' not found for chain {chain_id}")
