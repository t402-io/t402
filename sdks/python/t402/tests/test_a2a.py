"""Tests for A2A transport types and helpers."""

from t402.a2a import (
    T402_A2A_EXTENSION_URI,
    X402_A2A_EXTENSION_URI,
    A2A_EXTENSIONS_HEADER,
    META_PAYMENT_STATUS,
    META_PAYMENT_REQUIRED,
    META_PAYMENT_PAYLOAD,
    META_PAYMENT_RECEIPTS,
    META_PAYMENT_ERROR,
    X402_META_PAYMENT_STATUS,
    X402_META_PAYMENT_REQUIRED,
    X402_META_PAYMENT_PAYLOAD,
    X402_META_PAYMENT_RECEIPTS,
    X402_META_PAYMENT_ERROR,
    CAIP2_TO_FLAT_NAME,
    T402_TO_X402_ERROR_MAP,
    STATUS_PAYMENT_REQUIRED,
    STATUS_PAYMENT_SUBMITTED,
    STATUS_PAYMENT_COMPLETED,
    STATUS_PAYMENT_FAILED,
    A2AMessagePart,
    A2AMessage,
    A2ATaskStatus,
    A2ATask,
    A2AAgentCard,
    A2ASkill,
    is_payment_required,
    is_payment_completed,
    is_payment_failed,
    get_payment_required,
    get_payment_receipts,
    has_payment_payload,
    extract_payment_payload,
    map_t402_error_to_x402,
    downgrade_requirements_to_x402,
    is_standalone_flow,
    is_embedded_flow,
    create_payment_required_message,
    create_payment_submission_message,
    create_payment_completed_message,
    create_payment_failed_message,
    create_t402_extension,
    create_x402_extension,
)


def _make_payment_required_task():
    return A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(
            state="input-required",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[A2AMessagePart(kind="text", text="Pay up")],
                metadata={
                    META_PAYMENT_STATUS: STATUS_PAYMENT_REQUIRED,
                    META_PAYMENT_REQUIRED: {
                        "t402Version": 2,
                        "resource": "https://example.com/api",
                    },
                },
            ),
        ),
    )


def _make_payment_completed_task():
    return A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(
            state="completed",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[A2AMessagePart(kind="text", text="Done")],
                metadata={
                    META_PAYMENT_STATUS: STATUS_PAYMENT_COMPLETED,
                    META_PAYMENT_RECEIPTS: [{"txHash": "0xabc"}],
                },
            ),
        ),
    )


def _make_payment_failed_task():
    return A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(
            state="failed",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[
                    A2AMessagePart(kind="text", text="Failed"),
                ],
                metadata={
                    META_PAYMENT_STATUS: STATUS_PAYMENT_FAILED,
                    META_PAYMENT_ERROR: "T402-3001",
                },
            ),
        ),
    )


# --- Constants ---


def test_constants():
    assert T402_A2A_EXTENSION_URI == (
        "https://github.com/google-a2a/a2a-t402/v0.1"
    )
    assert A2A_EXTENSIONS_HEADER == "X-A2A-Extensions"


def test_x402_constants():
    assert X402_A2A_EXTENSION_URI == (
        "https://github.com/google-agentic-commerce/"
        "a2a-x402/blob/main/spec/v0.2"
    )
    assert X402_META_PAYMENT_STATUS == "x402.payment.status"
    assert X402_META_PAYMENT_REQUIRED == "x402.payment.required"
    assert X402_META_PAYMENT_PAYLOAD == "x402.payment.payload"
    assert X402_META_PAYMENT_RECEIPTS == "x402.payment.receipts"
    assert X402_META_PAYMENT_ERROR == "x402.payment.error"
    assert CAIP2_TO_FLAT_NAME["eip155:8453"] == "base"
    assert CAIP2_TO_FLAT_NAME["eip155:1"] == "ethereum"
    assert len(T402_TO_X402_ERROR_MAP) == 5


# --- is_payment_required ---


def test_is_payment_required_true():
    assert is_payment_required(_make_payment_required_task())


def test_is_payment_required_false_wrong_state():
    task = _make_payment_required_task()
    task.status.state = "working"
    assert not is_payment_required(task)


def test_is_payment_required_false_no_metadata():
    task = A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(state="input-required"),
    )
    assert not is_payment_required(task)


def test_is_payment_required_x402_only():
    """Task with only x402 metadata keys should be detected."""
    task = A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(
            state="input-required",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[],
                metadata={
                    X402_META_PAYMENT_STATUS: (
                        STATUS_PAYMENT_REQUIRED
                    ),
                    X402_META_PAYMENT_REQUIRED: {
                        "x402Version": 1,
                    },
                },
            ),
        ),
    )
    assert is_payment_required(task)
    req = get_payment_required(task)
    assert req is not None
    assert req["x402Version"] == 1


def test_is_payment_required_dual_namespace():
    """t402 key takes priority over x402 key."""
    task = A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(
            state="input-required",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[],
                metadata={
                    META_PAYMENT_STATUS: (
                        STATUS_PAYMENT_REQUIRED
                    ),
                    META_PAYMENT_REQUIRED: {
                        "t402Version": 2,
                        "source": "t402",
                    },
                    X402_META_PAYMENT_STATUS: (
                        STATUS_PAYMENT_REQUIRED
                    ),
                    X402_META_PAYMENT_REQUIRED: {
                        "x402Version": 1,
                        "source": "x402",
                    },
                },
            ),
        ),
    )
    assert is_payment_required(task)
    req = get_payment_required(task)
    assert req["source"] == "t402"


# --- is_payment_completed ---


def test_is_payment_completed_true():
    assert is_payment_completed(_make_payment_completed_task())


def test_is_payment_completed_false():
    task = _make_payment_completed_task()
    task.status.state = "working"
    assert not is_payment_completed(task)


# --- is_payment_failed ---


def test_is_payment_failed_true():
    assert is_payment_failed(_make_payment_failed_task())


def test_is_payment_failed_false():
    task = _make_payment_failed_task()
    task.status.state = "completed"
    assert not is_payment_failed(task)


# --- get_payment_required ---


def test_get_payment_required():
    task = _make_payment_required_task()
    req = get_payment_required(task)
    assert req is not None
    assert req["resource"] == "https://example.com/api"


def test_get_payment_required_none():
    task = A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(state="working"),
    )
    assert get_payment_required(task) is None


# --- get_payment_receipts ---


def test_get_payment_receipts():
    task = _make_payment_completed_task()
    receipts = get_payment_receipts(task)
    assert receipts is not None
    assert len(receipts) == 1


def test_get_payment_receipts_none():
    task = A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(state="working"),
    )
    assert get_payment_receipts(task) is None


# --- has_payment_payload ---


def test_has_payment_payload_true():
    msg = A2AMessage(
        kind="message",
        role="user",
        parts=[],
        metadata={
            META_PAYMENT_STATUS: STATUS_PAYMENT_SUBMITTED,
            META_PAYMENT_PAYLOAD: {"signature": "0xabc"},
        },
    )
    assert has_payment_payload(msg)


def test_has_payment_payload_false_no_metadata():
    msg = A2AMessage(kind="message", role="user", parts=[])
    assert not has_payment_payload(msg)


# --- extract_payment_payload ---


def test_extract_payment_payload():
    msg = A2AMessage(
        kind="message",
        role="user",
        parts=[],
        metadata={
            META_PAYMENT_PAYLOAD: {"signature": "0xabc"},
        },
    )
    payload = extract_payment_payload(msg)
    assert payload["signature"] == "0xabc"


def test_extract_payment_payload_none():
    msg = A2AMessage(kind="message", role="user", parts=[])
    assert extract_payment_payload(msg) is None


# --- create_* message helpers ---


def test_create_payment_required_message():
    msg = create_payment_required_message({"t402Version": 2})
    assert msg.role == "agent"
    assert msg.parts[0].text == (
        "Payment is required to complete this request."
    )
    assert (
        msg.metadata[META_PAYMENT_STATUS]
        == STATUS_PAYMENT_REQUIRED
    )
    assert msg.metadata[META_PAYMENT_REQUIRED] == {
        "t402Version": 2,
    }


def test_create_payment_required_message_custom_text():
    msg = create_payment_required_message(
        {"t402Version": 2}, "Pay now"
    )
    assert msg.parts[0].text == "Pay now"


def test_create_payment_submission_message():
    msg = create_payment_submission_message(
        {"signature": "0xabc"},
    )
    assert msg.role == "user"
    assert (
        msg.metadata[META_PAYMENT_STATUS]
        == STATUS_PAYMENT_SUBMITTED
    )
    assert msg.metadata[META_PAYMENT_PAYLOAD] == {
        "signature": "0xabc",
    }


def test_create_payment_completed_message():
    msg = create_payment_completed_message(
        [{"txHash": "0xabc"}],
    )
    assert msg.role == "agent"
    assert (
        msg.metadata[META_PAYMENT_STATUS]
        == STATUS_PAYMENT_COMPLETED
    )
    assert len(msg.metadata[META_PAYMENT_RECEIPTS]) == 1


def test_create_payment_failed_message():
    msg = create_payment_failed_message(
        [], "T402-3001", "Verification failed"
    )
    assert msg.role == "agent"
    assert (
        msg.metadata[META_PAYMENT_STATUS]
        == STATUS_PAYMENT_FAILED
    )
    assert msg.metadata[META_PAYMENT_ERROR] == "T402-3001"
    assert msg.parts[0].text == "Verification failed"


# --- create_t402_extension ---


def test_create_t402_extension():
    ext = create_t402_extension(required=True)
    assert ext.uri == T402_A2A_EXTENSION_URI
    assert ext.required is True
    assert "12 mechanisms" in ext.description


def test_create_t402_extension_optional():
    ext = create_t402_extension()
    assert ext.required is False


# --- Type construction ---


def test_a2a_skill():
    skill = A2ASkill(id="s1", name="Search", tags=["ai"])
    assert skill.id == "s1"
    assert skill.tags == ["ai"]


def test_a2a_agent_card():
    card = A2AAgentCard(
        name="TestAgent",
        url="https://agent.example.com",
        skills=[A2ASkill(id="s1", name="Pay")],
    )
    assert card.name == "TestAgent"
    assert len(card.skills) == 1


# ===== Phase 1 dual-namespace tests =====


# --- x402 dual-namespace reading ---


def test_create_payment_required_message_dual_namespace():
    """Write functions emit both t402 and x402 namespaces."""
    requirements = {
        "t402Version": 2,
        "accepts": [
            {
                "scheme": "exact",
                "network": "eip155:8453",
                "asset": "USDT",
                "amount": "100",
            },
        ],
    }
    msg = create_payment_required_message(requirements)
    # t402 namespace
    assert META_PAYMENT_STATUS in msg.metadata
    assert META_PAYMENT_REQUIRED in msg.metadata
    assert (
        msg.metadata[META_PAYMENT_STATUS]
        == STATUS_PAYMENT_REQUIRED
    )
    # x402 namespace
    assert X402_META_PAYMENT_STATUS in msg.metadata
    assert (
        msg.metadata[X402_META_PAYMENT_STATUS]
        == STATUS_PAYMENT_REQUIRED
    )
    # x402 downgraded requirements present for EVM+exact
    assert X402_META_PAYMENT_REQUIRED in msg.metadata
    x402_req = msg.metadata[X402_META_PAYMENT_REQUIRED]
    assert x402_req["x402Version"] == 1
    assert x402_req["accepts"][0]["network"] == "base"


def test_create_payment_submission_message_dual_namespace():
    """Submission message emits both namespaces."""
    msg = create_payment_submission_message(
        {"signature": "0xabc"},
    )
    assert (
        msg.metadata[META_PAYMENT_STATUS]
        == STATUS_PAYMENT_SUBMITTED
    )
    assert msg.metadata[META_PAYMENT_PAYLOAD] == {
        "signature": "0xabc",
    }
    assert (
        msg.metadata[X402_META_PAYMENT_STATUS]
        == STATUS_PAYMENT_SUBMITTED
    )
    assert msg.metadata[X402_META_PAYMENT_PAYLOAD] == {
        "signature": "0xabc",
    }


def test_create_payment_completed_message_dual_namespace():
    """Completed message emits both namespaces."""
    receipts = [{"txHash": "0xdef"}]
    msg = create_payment_completed_message(receipts)
    assert (
        msg.metadata[META_PAYMENT_STATUS]
        == STATUS_PAYMENT_COMPLETED
    )
    assert msg.metadata[META_PAYMENT_RECEIPTS] == receipts
    assert (
        msg.metadata[X402_META_PAYMENT_STATUS]
        == STATUS_PAYMENT_COMPLETED
    )
    assert msg.metadata[X402_META_PAYMENT_RECEIPTS] == receipts


def test_create_payment_failed_message_dual_namespace():
    """Failed message emits both namespaces with error mapping."""
    msg = create_payment_failed_message(
        [], "T402-2001", "Bad sig"
    )
    # t402 namespace
    assert msg.metadata[META_PAYMENT_ERROR] == "T402-2001"
    assert (
        msg.metadata[META_PAYMENT_STATUS]
        == STATUS_PAYMENT_FAILED
    )
    # x402 namespace — error mapped
    assert (
        msg.metadata[X402_META_PAYMENT_ERROR]
        == "INVALID_SIGNATURE"
    )
    assert (
        msg.metadata[X402_META_PAYMENT_STATUS]
        == STATUS_PAYMENT_FAILED
    )
    assert msg.metadata[X402_META_PAYMENT_RECEIPTS] == []


# --- map_t402_error_to_x402 ---


def test_map_t402_error_to_x402():
    assert map_t402_error_to_x402("T402-1001") == "INVALID_AMOUNT"
    assert (
        map_t402_error_to_x402("T402-2001") == "INVALID_SIGNATURE"
    )
    assert (
        map_t402_error_to_x402("T402-3001") == "SETTLEMENT_FAILED"
    )
    assert (
        map_t402_error_to_x402("T402-5001") == "SETTLEMENT_FAILED"
    )
    assert (
        map_t402_error_to_x402("T402-5002") == "SETTLEMENT_FAILED"
    )
    # Unknown code falls back
    assert (
        map_t402_error_to_x402("T402-9999") == "SETTLEMENT_FAILED"
    )


# --- downgrade_requirements_to_x402 ---


def test_downgrade_requirements_to_x402():
    requirements = {
        "t402Version": 2,
        "accepts": [
            {
                "scheme": "exact",
                "network": "eip155:8453",
                "asset": "USDT",
                "amount": "100",
            },
            {
                "scheme": "exact",
                "network": "eip155:1",
                "asset": "USDT",
                "amount": "100",
            },
        ],
    }
    result = downgrade_requirements_to_x402(requirements)
    assert result is not None
    assert result["x402Version"] == 1
    assert len(result["accepts"]) == 2
    assert result["accepts"][0]["network"] == "base"
    assert result["accepts"][1]["network"] == "ethereum"
    # Other fields preserved
    assert result["accepts"][0]["scheme"] == "exact"
    assert result["accepts"][0]["asset"] == "USDT"


def test_downgrade_requirements_non_evm_returns_none():
    """Non-EVM requirements produce None (no x402 downgrade)."""
    requirements = {
        "t402Version": 2,
        "accepts": [
            {
                "scheme": "exact",
                "network": "solana:mainnet",
                "asset": "USDT",
                "amount": "100",
            },
        ],
    }
    assert downgrade_requirements_to_x402(requirements) is None


def test_downgrade_requirements_upto_scheme_filtered():
    """Only exact scheme is included in x402 downgrade."""
    requirements = {
        "t402Version": 2,
        "accepts": [
            {
                "scheme": "upto",
                "network": "eip155:8453",
                "asset": "USDT",
                "maxAmount": "100",
            },
        ],
    }
    assert downgrade_requirements_to_x402(requirements) is None


def test_downgrade_requirements_not_dict():
    assert downgrade_requirements_to_x402("invalid") is None
    assert downgrade_requirements_to_x402(None) is None


# --- is_standalone_flow / is_embedded_flow ---


def test_is_standalone_flow():
    task = A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(
            state="input-required",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[],
                metadata={
                    X402_META_PAYMENT_STATUS: (
                        STATUS_PAYMENT_REQUIRED
                    ),
                    X402_META_PAYMENT_REQUIRED: {
                        "x402Version": 1,
                    },
                },
            ),
        ),
    )
    assert is_standalone_flow(task)
    assert not is_embedded_flow(task)


def test_is_embedded_flow():
    task = A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(
            state="input-required",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[],
                metadata={
                    X402_META_PAYMENT_STATUS: (
                        STATUS_PAYMENT_REQUIRED
                    ),
                },
            ),
        ),
    )
    assert is_embedded_flow(task)
    assert not is_standalone_flow(task)


def test_standalone_embedded_no_metadata():
    task = A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(state="working"),
    )
    assert not is_standalone_flow(task)
    assert not is_embedded_flow(task)


# --- create_x402_extension ---


def test_create_x402_extension():
    ext = create_x402_extension(required=True)
    assert ext.uri == X402_A2A_EXTENSION_URI
    assert ext.required is True
    assert "x402" in ext.description
    assert "EVM" in ext.description


def test_create_x402_extension_optional():
    ext = create_x402_extension()
    assert ext.required is False


def test_create_payment_required_no_x402_for_non_evm():
    """When requirements have no EVM+exact, x402 required is absent."""
    requirements = {
        "t402Version": 2,
        "accepts": [
            {
                "scheme": "exact",
                "network": "solana:mainnet",
                "asset": "USDT",
                "amount": "100",
            },
        ],
    }
    msg = create_payment_required_message(requirements)
    # t402 namespace always present
    assert META_PAYMENT_REQUIRED in msg.metadata
    # x402 status present, but no x402 requirements (no EVM)
    assert X402_META_PAYMENT_STATUS in msg.metadata
    assert X402_META_PAYMENT_REQUIRED not in msg.metadata
