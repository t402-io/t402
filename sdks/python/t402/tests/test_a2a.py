"""Tests for A2A transport types and helpers."""

from t402.a2a import (
    T402_A2A_EXTENSION_URI,
    A2A_EXTENSIONS_HEADER,
    META_PAYMENT_STATUS,
    META_PAYMENT_REQUIRED,
    META_PAYMENT_PAYLOAD,
    META_PAYMENT_RECEIPTS,
    META_PAYMENT_ERROR,
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
    create_payment_required_message,
    create_payment_submission_message,
    create_payment_completed_message,
    create_payment_failed_message,
    create_t402_extension,
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
                parts=[A2AMessagePart(kind="text", text="Failed")],
                metadata={
                    META_PAYMENT_STATUS: STATUS_PAYMENT_FAILED,
                    META_PAYMENT_ERROR: "T402-3001",
                },
            ),
        ),
    )


# --- Constants ---

def test_constants():
    assert T402_A2A_EXTENSION_URI == "https://github.com/google-a2a/a2a-t402/v0.1"
    assert A2A_EXTENSIONS_HEADER == "X-A2A-Extensions"


# --- is_payment_required ---

def test_is_payment_required_true():
    assert is_payment_required(_make_payment_required_task())


def test_is_payment_required_false_wrong_state():
    task = _make_payment_required_task()
    task.status.state = "working"
    assert not is_payment_required(task)


def test_is_payment_required_false_no_metadata():
    task = A2ATask(
        kind="task", id="task-1",
        status=A2ATaskStatus(state="input-required"),
    )
    assert not is_payment_required(task)


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
        kind="task", id="task-1",
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
        kind="task", id="task-1",
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
        metadata={META_PAYMENT_PAYLOAD: {"signature": "0xabc"}},
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
    assert msg.parts[0].text == "Payment is required to complete this request."
    assert msg.metadata[META_PAYMENT_STATUS] == STATUS_PAYMENT_REQUIRED
    assert msg.metadata[META_PAYMENT_REQUIRED] == {"t402Version": 2}


def test_create_payment_required_message_custom_text():
    msg = create_payment_required_message({"t402Version": 2}, "Pay now")
    assert msg.parts[0].text == "Pay now"


def test_create_payment_submission_message():
    msg = create_payment_submission_message({"signature": "0xabc"})
    assert msg.role == "user"
    assert msg.metadata[META_PAYMENT_STATUS] == STATUS_PAYMENT_SUBMITTED
    assert msg.metadata[META_PAYMENT_PAYLOAD] == {"signature": "0xabc"}


def test_create_payment_completed_message():
    msg = create_payment_completed_message([{"txHash": "0xabc"}])
    assert msg.role == "agent"
    assert msg.metadata[META_PAYMENT_STATUS] == STATUS_PAYMENT_COMPLETED
    assert len(msg.metadata[META_PAYMENT_RECEIPTS]) == 1


def test_create_payment_failed_message():
    msg = create_payment_failed_message([], "T402-3001", "Verification failed")
    assert msg.role == "agent"
    assert msg.metadata[META_PAYMENT_STATUS] == STATUS_PAYMENT_FAILED
    assert msg.metadata[META_PAYMENT_ERROR] == "T402-3001"
    assert msg.parts[0].text == "Verification failed"


# --- create_t402_extension ---

def test_create_t402_extension():
    ext = create_t402_extension(required=True)
    assert ext.uri == T402_A2A_EXTENSION_URI
    assert ext.required is True


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
