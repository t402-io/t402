# T402 Multi-sig (Safe) SDK 開發計劃

## 概述

根據 SDK 分析，Multi-sig (Safe) 功能目前只有 TypeScript 實作。本計劃將此功能擴展到 Go、Python、Java SDK。

## 目標

為 Go、Python、Java SDK 添加 Safe Multi-sig 支援，與 TypeScript `@t402/wdk-multisig` 功能對等。

---

## Phase 1: Go SDK Multi-sig

### 1.1 檔案結構
```
sdks/go/
├── wdk/
│   └── multisig/
│       ├── safe.go           # Safe contract interaction
│       ├── transaction.go    # Safe transaction builder
│       ├── signature.go      # Multi-sig signature collection
│       ├── types.go          # Safe types
│       └── multisig_test.go  # Tests
```

### 1.2 核心功能
- [x] Safe contract ABI integration
- [x] Transaction proposal creation
- [x] Signature collection and aggregation
- [x] Transaction execution
- [x] Threshold validation

### 1.3 API 設計
```go
type SafeClient struct {
    Address    common.Address
    RPC        *ethclient.Client
    ChainID    *big.Int
}

func (s *SafeClient) ProposeTransaction(to common.Address, value *big.Int, data []byte) (*SafeTransaction, error)
func (s *SafeClient) SignTransaction(tx *SafeTransaction, signer crypto.Signer) (*SafeSignature, error)
func (s *SafeClient) ExecuteTransaction(tx *SafeTransaction, signatures []*SafeSignature) (*types.Transaction, error)
func (s *SafeClient) GetThreshold() (uint64, error)
func (s *SafeClient) GetOwners() ([]common.Address, error)
```

---

## Phase 2: Python SDK Multi-sig

### 2.1 檔案結構
```
sdks/python/t402/src/t402/
├── multisig/
│   ├── __init__.py
│   ├── safe.py              # Safe client
│   ├── transaction.py       # Transaction builder
│   ├── signature.py         # Signature handling
│   └── types.py             # Type definitions
tests/
└── test_multisig.py
```

### 2.2 核心功能
- [x] Safe contract interaction via web3.py
- [x] Transaction proposal with EIP-712 hashing
- [x] Signature aggregation
- [x] Execution with collected signatures

### 2.3 API 設計
```python
class SafeClient:
    def __init__(self, address: str, rpc_url: str, chain_id: int): ...

    async def propose_transaction(self, to: str, value: int, data: bytes) -> SafeTransaction: ...
    async def sign_transaction(self, tx: SafeTransaction, signer: LocalAccount) -> SafeSignature: ...
    async def execute_transaction(self, tx: SafeTransaction, signatures: List[SafeSignature]) -> TxReceipt: ...
    async def get_threshold(self) -> int: ...
    async def get_owners(self) -> List[str]: ...
```

---

## Phase 3: Java SDK Multi-sig

### 3.1 檔案結構
```
sdks/java/t402/src/main/java/io/t402/
├── multisig/
│   ├── SafeClient.java
│   ├── SafeTransaction.java
│   ├── SafeSignature.java
│   ├── SafeTransactionBuilder.java
│   └── SafeConstants.java
src/test/java/io/t402/multisig/
└── SafeClientTest.java
```

### 3.2 核心功能
- [x] Safe contract interaction via Web3j
- [x] Transaction builder pattern
- [x] Signature collection
- [x] Multi-sig execution

### 3.3 API 設計
```java
public class SafeClient {
    public SafeClient(String address, Web3j web3j, long chainId);

    public SafeTransaction proposeTransaction(String to, BigInteger value, byte[] data);
    public SafeSignature signTransaction(SafeTransaction tx, Credentials signer);
    public TransactionReceipt executeTransaction(SafeTransaction tx, List<SafeSignature> signatures);
    public long getThreshold();
    public List<String> getOwners();
}
```

---

## 實作順序

1. **Phase 1: Go SDK** (優先 - 與 Facilitator 同語言)
2. **Phase 2: Python SDK**
3. **Phase 3: Java SDK**

---

## 參考實作

TypeScript 參考: `sdks/typescript/packages/wdk-multisig/`

關鍵檔案:
- `src/safe/client.ts` - Safe client implementation
- `src/safe/transaction.ts` - Transaction building
- `src/safe/signature.ts` - Signature handling

---

## 驗證標準

每個 SDK 必須通過:
1. 單元測試 (mock Safe contract)
2. 整合測試 (testnet Safe)
3. 與 TypeScript 實作的互操作性測試

---

## 時程

- Phase 1 (Go): ✅ 完成
- Phase 2 (Python): ✅ 完成
- Phase 3 (Java): ✅ 完成
