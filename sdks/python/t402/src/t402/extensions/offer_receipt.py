"""Offer and Receipt extension for t402.

Offers: Server commits to payment terms (signed before payment).
Receipts: Server confirms transaction completion (signed after payment).
Supports EIP-712 signing format.
"""

import time
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Protocol


EXTENSION_KEY = "offer-receipt"

# EIP-712 constants (chainId=1 for off-chain signing)
OFFER_DOMAIN = {"name": "t402 offer", "version": "1", "chainId": 1}
RECEIPT_DOMAIN = {"name": "t402 receipt", "version": "1", "chainId": 1}

OFFER_TYPES = [
    {"name": "version", "type": "uint256"},
    {"name": "resourceUrl", "type": "string"},
    {"name": "scheme", "type": "string"},
    {"name": "network", "type": "string"},
    {"name": "asset", "type": "string"},
    {"name": "payTo", "type": "string"},
    {"name": "amount", "type": "string"},
    {"name": "validUntil", "type": "uint256"},
]

RECEIPT_TYPES = [
    {"name": "version", "type": "uint256"},
    {"name": "network", "type": "string"},
    {"name": "resourceUrl", "type": "string"},
    {"name": "payer", "type": "string"},
    {"name": "issuedAt", "type": "uint256"},
    {"name": "transaction", "type": "string"},
]


@dataclass
class OfferPayload:
    version: int
    resource_url: str
    scheme: str
    network: str
    asset: str
    pay_to: str
    amount: str
    valid_until: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "resourceUrl": self.resource_url,
            "scheme": self.scheme,
            "network": self.network,
            "asset": self.asset,
            "payTo": self.pay_to,
            "amount": self.amount,
            "validUntil": self.valid_until,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "OfferPayload":
        return cls(
            version=d["version"],
            resource_url=d["resourceUrl"],
            scheme=d["scheme"],
            network=d["network"],
            asset=d["asset"],
            pay_to=d["payTo"],
            amount=d["amount"],
            valid_until=d.get("validUntil", 0),
        )


@dataclass
class ReceiptPayload:
    version: int
    network: str
    resource_url: str
    payer: str
    issued_at: int
    transaction: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "network": self.network,
            "resourceUrl": self.resource_url,
            "payer": self.payer,
            "issuedAt": self.issued_at,
            "transaction": self.transaction,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ReceiptPayload":
        return cls(
            version=d["version"],
            network=d["network"],
            resource_url=d["resourceUrl"],
            payer=d["payer"],
            issued_at=d["issuedAt"],
            transaction=d.get("transaction", ""),
        )


@dataclass
class SignedOffer:
    format: str  # "eip712" or "jws"
    signature: str
    payload: Optional[OfferPayload] = None
    accept_index: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"format": self.format, "signature": self.signature}
        if self.payload:
            d["payload"] = self.payload.to_dict()
        if self.accept_index is not None:
            d["acceptIndex"] = self.accept_index
        return d


@dataclass
class SignedReceipt:
    format: str
    signature: str
    payload: Optional[ReceiptPayload] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"format": self.format, "signature": self.signature}
        if self.payload:
            d["payload"] = self.payload.to_dict()
        return d


class OfferReceiptSigner(Protocol):
    def sign_offer(self, payload: OfferPayload) -> str: ...
    def sign_receipt(self, payload: ReceiptPayload) -> str: ...
    def get_address(self) -> str: ...


class OfferReceiptVerifier(Protocol):
    def recover_offer_signer(self, payload: OfferPayload, signature: str) -> str: ...
    def recover_receipt_signer(self, payload: ReceiptPayload, signature: str) -> str: ...


def normalize_offer_for_signing(p: OfferPayload) -> Dict[str, Any]:
    return p.to_dict()


def normalize_receipt_for_signing(p: ReceiptPayload) -> Dict[str, Any]:
    return p.to_dict()


def create_signed_offer(
    signer: OfferReceiptSigner, payload: OfferPayload, accept_index: Optional[int] = None
) -> SignedOffer:
    sig = signer.sign_offer(payload)
    return SignedOffer(
        format="eip712", signature=sig, payload=payload, accept_index=accept_index
    )


def create_signed_receipt(signer: OfferReceiptSigner, payload: ReceiptPayload) -> SignedReceipt:
    sig = signer.sign_receipt(payload)
    return SignedReceipt(format="eip712", signature=sig, payload=payload)


@dataclass
class VerifyResult:
    valid: bool
    signer: str = ""
    payload: Optional[Any] = None


def verify_offer(verifier: OfferReceiptVerifier, offer: SignedOffer) -> VerifyResult:
    if offer.format != "eip712" or offer.payload is None:
        return VerifyResult(valid=False)
    try:
        signer_addr = verifier.recover_offer_signer(offer.payload, offer.signature)
        return VerifyResult(valid=True, signer=signer_addr, payload=offer.payload)
    except Exception:
        return VerifyResult(valid=False)


def verify_receipt(verifier: OfferReceiptVerifier, receipt: SignedReceipt) -> VerifyResult:
    if receipt.format != "eip712" or receipt.payload is None:
        return VerifyResult(valid=False)
    try:
        signer_addr = verifier.recover_receipt_signer(receipt.payload, receipt.signature)
        return VerifyResult(valid=True, signer=signer_addr, payload=receipt.payload)
    except Exception:
        return VerifyResult(valid=False)


def match_offer_to_requirements(
    offer: SignedOffer, scheme: str, network: str, asset: str, pay_to: str, amount: str
) -> bool:
    if offer.format != "eip712" or offer.payload is None:
        return False
    p = offer.payload
    return (
        p.scheme == scheme
        and p.network == network
        and p.asset.lower() == asset.lower()
        and p.pay_to.lower() == pay_to.lower()
        and p.amount == amount
    )


def is_offer_expired(offer: SignedOffer, now_seconds: Optional[int] = None) -> bool:
    if offer.format != "eip712" or offer.payload is None:
        return True
    if offer.payload.valid_until == 0:
        return False
    now = now_seconds if now_seconds is not None else int(time.time())
    return now > offer.payload.valid_until


def create_offers_from_requirements(
    signer: OfferReceiptSigner,
    resource_url: str,
    accepts: List[Dict[str, str]],
    offer_validity_seconds: int = 0,
) -> List[SignedOffer]:
    now = int(time.time())
    valid_until = now + offer_validity_seconds if offer_validity_seconds > 0 else 0

    offers = []
    for i, a in enumerate(accepts):
        payload = OfferPayload(
            version=1,
            resource_url=resource_url,
            scheme=a["scheme"],
            network=a["network"],
            asset=a["asset"],
            pay_to=a["payTo"],
            amount=a["amount"],
            valid_until=valid_until,
        )
        offers.append(create_signed_offer(signer, payload, accept_index=i))
    return offers


def create_receipt_for_payment(
    signer: OfferReceiptSigner,
    resource_url: str,
    network: str,
    payer: str,
    transaction: str = "",
) -> SignedReceipt:
    payload = ReceiptPayload(
        version=1,
        network=network,
        resource_url=resource_url,
        payer=payer,
        issued_at=int(time.time()),
        transaction=transaction,
    )
    return create_signed_receipt(signer, payload)


def extract_offers(extensions: Optional[Dict[str, Any]]) -> List[SignedOffer]:
    if not extensions:
        return []
    ext = extensions.get(EXTENSION_KEY)
    if not ext or not isinstance(ext, dict):
        return []
    info = ext.get("info", {})
    raw_offers = info.get("offers", [])
    return [
        SignedOffer(
            format=o.get("format", ""),
            signature=o.get("signature", ""),
            payload=OfferPayload.from_dict(o["payload"]) if "payload" in o else None,
            accept_index=o.get("acceptIndex"),
        )
        for o in raw_offers
    ]


def extract_receipt(extensions: Optional[Dict[str, Any]]) -> Optional[SignedReceipt]:
    if not extensions:
        return None
    ext = extensions.get(EXTENSION_KEY)
    if not ext or not isinstance(ext, dict):
        return None
    info = ext.get("info", {})
    r = info.get("receipt")
    if not r:
        return None
    return SignedReceipt(
        format=r.get("format", ""),
        signature=r.get("signature", ""),
        payload=ReceiptPayload.from_dict(r["payload"]) if "payload" in r else None,
    )
