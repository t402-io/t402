package dispute

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

const (
	payerAddress     = "0x1234567890abcdef1234567890abcdef12345678"
	arbiterAddress   = "0xabcdef1234567890abcdef1234567890abcdef12"
	sampleReceiptHsh = "0xcafedade000000000000000000000000000000000000000000000000deadbeef"
	sampleDisputeHsh = "0xbeefface000000000000000000000000000000000000000000000000feedf00d"
)

const nowUnix int64 = 1_716_000_000

// --- mock signer / verifier ---

type mockSigner struct {
	address string
}

func (m *mockSigner) SignDispute(_ *DisputePayload) (string, error) {
	return "0xdispute_sig_" + m.address[len(m.address)-6:], nil
}

func (m *mockSigner) SignResolution(_ *ResolutionPayload) (string, error) {
	return "0xresolution_sig_" + m.address[len(m.address)-6:], nil
}

func (m *mockSigner) GetAddress() string {
	return m.address
}

type mockVerifier struct {
	returnAddress string
}

func (m *mockVerifier) RecoverDisputeSigner(_ *DisputePayload, _ string) (string, error) {
	return m.returnAddress, nil
}

func (m *mockVerifier) RecoverResolutionSigner(_ *ResolutionPayload, _ string) (string, error) {
	return m.returnAddress, nil
}

type failingVerifier struct{}

func (failingVerifier) RecoverDisputeSigner(_ *DisputePayload, _ string) (string, error) {
	return "", errors.New("invalid signature")
}

func (failingVerifier) RecoverResolutionSigner(_ *ResolutionPayload, _ string) (string, error) {
	return "", errors.New("invalid signature")
}

func sampleDispute() *DisputePayload {
	return &DisputePayload{
		Version:         1,
		ReceiptHash:     sampleReceiptHsh,
		Reason:          ReasonNotDelivered,
		RequestedAmount: "1000000",
		ValidUntil:      nowUnix + 86_400,
		Evidence:        []string{"ipfs://QmEvidenceHash/complaint.json"},
	}
}

func sampleResolution() *ResolutionPayload {
	return &ResolutionPayload{
		Version:           1,
		DisputeHash:       sampleDisputeHsh,
		Verdict:           VerdictUpheldFull,
		SettledAmount:     "1000000",
		Arbiter:           arbiterAddress,
		IssuedAt:          nowUnix + 100,
		RefundTransaction: "0xrefundtx0000000000000000000000000000000000000000",
	}
}

func sampleTerms() TermsInfo {
	return TermsInfo{
		Arbiter:       arbiterAddress,
		ArbiterScheme: ArbiterFacilitator,
		DisputeWindow: 86_400 * 7,
		SupportedReasons: []DisputeReason{
			ReasonNotDelivered,
			ReasonPartialDelivery,
			ReasonQualityIssue,
		},
		EvidenceURISchemes: []string{"ipfs", "arweave", "https"},
	}
}

// --- EIP-712 constants ---

func TestDisputeDomain(t *testing.T) {
	d := DisputeDomain()
	if d["name"] != "T402Dispute" {
		t.Errorf("dispute domain name: want T402Dispute got %v", d["name"])
	}
	if d["version"] != "1" {
		t.Errorf("dispute domain version: want 1 got %v", d["version"])
	}
}

func TestResolutionDomainSharesNamespace(t *testing.T) {
	if DisputeDomain()["name"] != ResolutionDomain()["name"] {
		t.Error("resolution domain should share name with dispute domain")
	}
}

func TestDisputeTypes(t *testing.T) {
	types := DisputeTypes()
	want := []string{"version", "receiptHash", "reason", "requestedAmount", "validUntil", "evidence"}
	if len(types) != len(want) {
		t.Fatalf("dispute types: want %d fields got %d", len(want), len(types))
	}
	for i, n := range want {
		if types[i]["name"] != n {
			t.Errorf("dispute type field %d: want %s got %s", i, n, types[i]["name"])
		}
	}
}

func TestResolutionTypes(t *testing.T) {
	types := ResolutionTypes()
	want := []string{"version", "disputeHash", "verdict", "settledAmount", "arbiter", "issuedAt", "refundTransaction"}
	if len(types) != len(want) {
		t.Fatalf("resolution types: want %d fields got %d", len(want), len(types))
	}
	for i, n := range want {
		if types[i]["name"] != n {
			t.Errorf("resolution type field %d: want %s got %s", i, n, types[i]["name"])
		}
	}
}

func TestNormalizeDisputeFillsEmptyEvidence(t *testing.T) {
	p := sampleDispute()
	p.Evidence = nil
	norm := NormalizeDisputeForSigning(p)
	ev, _ := norm["evidence"].([]string)
	if ev == nil || len(ev) != 0 {
		t.Errorf("normalize dispute should default to empty evidence list, got %v", norm["evidence"])
	}
}

func TestNormalizeResolutionDefaultsRefundTx(t *testing.T) {
	p := sampleResolution()
	p.RefundTransaction = ""
	norm := NormalizeResolutionForSigning(p)
	if norm["refundTransaction"] != "" {
		t.Errorf("expected empty refundTransaction, got %v", norm["refundTransaction"])
	}
}

// --- Enums ---

func TestStandardReasons(t *testing.T) {
	want := []DisputeReason{
		ReasonNotDelivered, ReasonPartialDelivery, ReasonQualityIssue,
		ReasonUnauthorized, ReasonServiceUnavailable, ReasonDuplicateCharge,
		ReasonOther,
	}
	if len(StandardReasons) != len(want) {
		t.Fatalf("StandardReasons: want %d got %d", len(want), len(StandardReasons))
	}
	for i, r := range want {
		if StandardReasons[i] != r {
			t.Errorf("StandardReasons[%d]: want %s got %s", i, r, StandardReasons[i])
		}
	}
}

func TestVerdicts(t *testing.T) {
	want := []Verdict{VerdictUpheldFull, VerdictUpheldPartial, VerdictDenied, VerdictVoid}
	if len(Verdicts) != len(want) {
		t.Fatalf("Verdicts: want %d got %d", len(want), len(Verdicts))
	}
}

func TestArbiterSchemes(t *testing.T) {
	want := []ArbiterScheme{ArbiterFacilitator, ArbiterContract, ArbiterExternal, ArbiterNone}
	if len(ArbiterSchemes) != len(want) {
		t.Fatalf("ArbiterSchemes: want %d got %d", len(want), len(ArbiterSchemes))
	}
}

func TestExtensionKey(t *testing.T) {
	if ExtensionKey != "dispute" {
		t.Errorf("ExtensionKey: want dispute got %s", ExtensionKey)
	}
}

func TestIsReasonWellFormed(t *testing.T) {
	if !IsReasonWellFormed("not_delivered") {
		t.Error("standard reason should be well-formed")
	}
	if !IsReasonWellFormed("x_gdpr_violation") {
		t.Error("x_-prefixed reason should be well-formed")
	}
	if IsReasonWellFormed("invalid_typo") {
		t.Error("typo'd reason should not be well-formed")
	}
}

// --- Signing roundtrip ---

func TestCreateAndVerifyDispute(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	signed, err := CreateSignedDispute(signer, sampleDispute(), "")
	if err != nil {
		t.Fatalf("CreateSignedDispute: %v", err)
	}
	if signed.Format != FormatEIP712 {
		t.Errorf("format: want eip712 got %s", signed.Format)
	}
	result, err := VerifyDispute(verifier, signed)
	if err != nil {
		t.Fatalf("VerifyDispute: %v", err)
	}
	if !result.Valid {
		t.Error("VerifyDispute: want valid")
	}
	if !strings.EqualFold(result.Signer, payerAddress) {
		t.Errorf("Signer: want %s got %s", payerAddress, result.Signer)
	}
}

func TestCreateDisputeRecordsExplicitDelegate(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	delegate := "0xdelegate1111111111111111111111111111111111"
	signed, err := CreateSignedDispute(signer, sampleDispute(), delegate)
	if err != nil {
		t.Fatalf("CreateSignedDispute: %v", err)
	}
	if signed.Signer != delegate {
		t.Errorf("Signer: want delegate %s got %s", delegate, signed.Signer)
	}
	result, _ := VerifyDispute(verifier, signed)
	if result.Signer != delegate {
		t.Errorf("VerifyDispute Signer: want delegate got %s", result.Signer)
	}
}

func TestCreateAndVerifyResolution(t *testing.T) {
	signer := &mockSigner{address: arbiterAddress}
	verifier := &mockVerifier{returnAddress: arbiterAddress}
	signed, err := CreateSignedResolution(signer, sampleResolution())
	if err != nil {
		t.Fatalf("CreateSignedResolution: %v", err)
	}
	result, err := VerifyResolution(verifier, signed, arbiterAddress)
	if err != nil {
		t.Fatalf("VerifyResolution: %v", err)
	}
	if !result.Valid {
		t.Error("VerifyResolution: want valid")
	}
}

func TestVerifyDisputeFailureOnSignatureError(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	signed, _ := CreateSignedDispute(signer, sampleDispute(), "")
	result, err := VerifyDispute(failingVerifier{}, signed)
	if err != nil {
		t.Fatalf("VerifyDispute: %v", err)
	}
	if result.Valid {
		t.Error("VerifyDispute should fail on signature error")
	}
}

func TestVerifyResolutionArbiterMismatch(t *testing.T) {
	signer := &mockSigner{address: arbiterAddress}
	verifier := &mockVerifier{returnAddress: arbiterAddress}
	signed, _ := CreateSignedResolution(signer, sampleResolution())
	result, _ := VerifyResolution(verifier, signed, "0xwrongarbiter")
	if result.Valid {
		t.Error("VerifyResolution should reject arbiter mismatch")
	}
}

func TestVerifyDisputeRejectsJWS(t *testing.T) {
	jws := &SignedDispute{Format: FormatJWS, Signature: "0x"}
	_, err := VerifyDispute(failingVerifier{}, jws)
	if !errors.Is(err, ErrJWSReserved) {
		t.Errorf("want ErrJWSReserved got %v", err)
	}
}

// --- Time windows ---

func TestIsDisputeExpired(t *testing.T) {
	signed := &SignedDispute{
		Format:  FormatEIP712,
		Payload: &DisputePayload{ValidUntil: nowUnix + 100},
	}
	if IsDisputeExpired(signed, time.Unix(nowUnix, 0)) {
		t.Error("should not be expired")
	}
	signed.Payload.ValidUntil = nowUnix - 100
	if !IsDisputeExpired(signed, time.Unix(nowUnix, 0)) {
		t.Error("should be expired")
	}
}

// --- Verdict ↔ amount consistency ---

func TestVerdictAmountConsistency(t *testing.T) {
	make := func(v Verdict, settled string) *SignedResolution {
		p := *sampleResolution()
		p.Verdict = v
		p.SettledAmount = settled
		return &SignedResolution{Format: FormatEIP712, Payload: &p}
	}
	cases := []struct {
		name      string
		res       *SignedResolution
		requested string
		want      bool
	}{
		{"denied/zero", make(VerdictDenied, "0"), "1000000", true},
		{"denied/nonzero", make(VerdictDenied, "1"), "1000000", false},
		{"void/zero", make(VerdictVoid, "0"), "1000000", true},
		{"void/nonzero", make(VerdictVoid, "1"), "1000000", false},
		{"upheld_full/equal", make(VerdictUpheldFull, "1000000"), "1000000", true},
		{"upheld_full/less", make(VerdictUpheldFull, "500000"), "1000000", false},
		{"upheld_full/more", make(VerdictUpheldFull, "1000001"), "1000000", false},
		{"upheld_partial/half", make(VerdictUpheldPartial, "500000"), "1000000", true},
		{"upheld_partial/zero", make(VerdictUpheldPartial, "0"), "1000000", false},
		{"upheld_partial/more", make(VerdictUpheldPartial, "1000001"), "1000000", false},
		{"unknown verdict", make("rogue", "0"), "0", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := IsVerdictAmountConsistent(tc.res, tc.requested)
			if got != tc.want {
				t.Errorf("verdict=%s settled=%s requested=%s: want %v got %v",
					tc.res.Payload.Verdict, tc.res.Payload.SettledAmount, tc.requested, tc.want, got)
			}
		})
	}
}

// --- Client helpers ---

func TestBuildDisputePayloadDefaults(t *testing.T) {
	p := BuildDisputePayload(BuildDisputePayloadParams{
		ReceiptHash:     sampleReceiptHsh,
		Reason:          ReasonNotDelivered,
		RequestedAmount: "1000000",
	})
	if p.Version != 1 {
		t.Errorf("version default: want 1 got %d", p.Version)
	}
	if p.ValidUntil <= time.Now().Unix() {
		t.Errorf("validUntil default should be in the future, got %d", p.ValidUntil)
	}
}

func TestBuildDisputePayloadExplicitValues(t *testing.T) {
	p := BuildDisputePayload(BuildDisputePayloadParams{
		ReceiptHash:     sampleReceiptHsh,
		Reason:          ReasonQualityIssue,
		RequestedAmount: "500000",
		Evidence:        []string{"ipfs://X"},
		ValidUntil:      12345,
		Version:         2,
	})
	if p.ValidUntil != 12345 || p.Version != 2 {
		t.Errorf("explicit values not preserved: %+v", p)
	}
	if len(p.Evidence) != 1 || p.Evidence[0] != "ipfs://X" {
		t.Errorf("evidence not preserved: %v", p.Evidence)
	}
}

func TestBuildAndSignDispute(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	signed, err := BuildAndSignDispute(signer, BuildDisputePayloadParams{
		ReceiptHash:     sampleReceiptHsh,
		Reason:          ReasonNotDelivered,
		RequestedAmount: "1000000",
	}, "")
	if err != nil || signed == nil {
		t.Fatalf("BuildAndSignDispute: err=%v", err)
	}
}

func TestExtractDisputeTerms(t *testing.T) {
	terms := sampleTerms()
	ext := RequirementsExtension{Info: terms}
	raw, _ := json.Marshal(ext)
	extensions := map[string]json.RawMessage{ExtensionKey: raw}
	got := ExtractDisputeTerms(extensions)
	if got == nil {
		t.Fatal("ExtractDisputeTerms: got nil")
	}
	if got.Arbiter != terms.Arbiter || got.DisputeWindow != terms.DisputeWindow {
		t.Errorf("ExtractDisputeTerms mismatch: %+v vs %+v", got, terms)
	}
}

func TestExtractDisputeTermsAbsent(t *testing.T) {
	got := ExtractDisputeTerms(nil)
	if got != nil {
		t.Errorf("ExtractDisputeTerms on nil: want nil got %+v", got)
	}
	got = ExtractDisputeTerms(map[string]json.RawMessage{"other": []byte("{}")})
	if got != nil {
		t.Errorf("ExtractDisputeTerms with no dispute key: want nil")
	}
}

func TestBuildDisputeSubmissionBody(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	signed, _ := CreateSignedDispute(signer, sampleDispute(), "")
	body := BuildDisputeSubmissionBody(signed)
	raw, _ := json.Marshal(body)
	parsed := ParseDisputeSubmission(raw)
	if parsed == nil {
		t.Fatal("parsed nil")
	}
	if parsed.Signature != signed.Signature {
		t.Errorf("roundtrip signature mismatch")
	}
}

// --- Server helpers ---

func TestBuildDisputeRequirementsValid(t *testing.T) {
	terms := sampleTerms()
	req, err := BuildDisputeRequirements(terms)
	if err != nil {
		t.Fatalf("BuildDisputeRequirements: %v", err)
	}
	if req.Info.Arbiter != terms.Arbiter {
		t.Error("requirements arbiter mismatch")
	}
}

func TestBuildDisputeRequirementsRejectsInvalid(t *testing.T) {
	bad := sampleTerms()
	bad.ArbiterScheme = "invalid"
	if _, err := BuildDisputeRequirements(bad); err == nil {
		t.Error("expected error for invalid arbiterScheme")
	}
	bad = sampleTerms()
	bad.DisputeWindow = 0
	if _, err := BuildDisputeRequirements(bad); err == nil {
		t.Error("expected error for zero disputeWindow")
	}
	bad = sampleTerms()
	bad.SupportedReasons = nil
	if _, err := BuildDisputeRequirements(bad); err == nil {
		t.Error("expected error for empty supportedReasons")
	}
}

func TestParseDisputeSubmissionMalformed(t *testing.T) {
	if got := ParseDisputeSubmission([]byte("not json")); got != nil {
		t.Error("ParseDisputeSubmission: want nil for non-json")
	}
	if got := ParseDisputeSubmission([]byte("{}")); got != nil {
		t.Error("ParseDisputeSubmission: want nil for empty object")
	}
	if got := ParseDisputeSubmission([]byte(`{"extensions":{}}`)); got != nil {
		t.Error("ParseDisputeSubmission: want nil when dispute key absent")
	}
}

func TestValidateDisputeHappyPath(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	signed, _ := CreateSignedDispute(signer, sampleDispute(), "")
	result, err := ValidateDispute(ValidateDisputeInput{
		Verifier:        verifier,
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - 60,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           sampleTerms(),
		Now:             time.Unix(nowUnix, 0),
	})
	if err != nil {
		t.Fatalf("ValidateDispute: %v", err)
	}
	if !result.Valid {
		t.Errorf("ValidateDispute: want valid, got err=%s detail=%s", result.Error, result.Detail)
	}
}

func TestValidateDisputeBadSignature(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	signed, _ := CreateSignedDispute(signer, sampleDispute(), "")
	result, _ := ValidateDispute(ValidateDisputeInput{
		Verifier:        failingVerifier{},
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - 60,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           sampleTerms(),
		Now:             time.Unix(nowUnix, 0),
	})
	if result.Valid || result.Error != ErrDisputeInvalidSignature {
		t.Errorf("want dispute_invalid_signature, got %+v", result)
	}
}

func TestValidateDisputeExpired(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	payload := sampleDispute()
	payload.ValidUntil = nowUnix - 1
	signed, _ := CreateSignedDispute(signer, payload, "")
	result, _ := ValidateDispute(ValidateDisputeInput{
		Verifier:        verifier,
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - 60,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           sampleTerms(),
		Now:             time.Unix(nowUnix, 0),
	})
	if result.Valid || result.Error != ErrDisputeExpired {
		t.Errorf("want dispute_expired, got %+v", result)
	}
}

func TestValidateDisputeReceiptMismatch(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	payload := sampleDispute()
	payload.ReceiptHash = "0xdifferenthash" + strings.Repeat("0", 52)
	signed, _ := CreateSignedDispute(signer, payload, "")
	result, _ := ValidateDispute(ValidateDisputeInput{
		Verifier:        verifier,
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - 60,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           sampleTerms(),
		Now:             time.Unix(nowUnix, 0),
	})
	if result.Valid || result.Error != ErrDisputeUnknownReceipt {
		t.Errorf("want dispute_unknown_receipt, got %+v", result)
	}
}

func TestValidateDisputeOutOfWindow(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	signed, _ := CreateSignedDispute(signer, sampleDispute(), "")
	terms := sampleTerms()
	result, _ := ValidateDispute(ValidateDisputeInput{
		Verifier:        verifier,
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - terms.DisputeWindow - 100,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           terms,
		Now:             time.Unix(nowUnix, 0),
	})
	if result.Valid || result.Error != ErrDisputeOutOfWindow {
		t.Errorf("want dispute_out_of_window, got %+v", result)
	}
}

func TestValidateDisputeUnsupportedReason(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	payload := sampleDispute()
	payload.Reason = ReasonDuplicateCharge // not in sampleTerms' SupportedReasons
	signed, _ := CreateSignedDispute(signer, payload, "")
	result, _ := ValidateDispute(ValidateDisputeInput{
		Verifier:        verifier,
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - 60,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           sampleTerms(),
		Now:             time.Unix(nowUnix, 0),
	})
	if result.Valid || result.Error != ErrDisputeInvalidReason {
		t.Errorf("want dispute_invalid_reason, got %+v", result)
	}
}

func TestValidateDisputeCustomReasonAccepted(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	payload := sampleDispute()
	payload.Reason = "x_gdpr_violation"
	signed, _ := CreateSignedDispute(signer, payload, "")
	terms := sampleTerms()
	terms.SupportedReasons = []DisputeReason{ReasonNotDelivered, "x_gdpr_violation"}
	result, _ := ValidateDispute(ValidateDisputeInput{
		Verifier:        verifier,
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - 60,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           terms,
		Now:             time.Unix(nowUnix, 0),
	})
	if !result.Valid {
		t.Errorf("want valid for x_ reason, got %+v", result)
	}
}

func TestValidateDisputeAmountExceedsReceipt(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	payload := sampleDispute()
	payload.RequestedAmount = "1000001"
	signed, _ := CreateSignedDispute(signer, payload, "")
	result, _ := ValidateDispute(ValidateDisputeInput{
		Verifier:        verifier,
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - 60,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           sampleTerms(),
		Now:             time.Unix(nowUnix, 0),
	})
	if result.Valid || result.Error != ErrDisputeAmountExceedsReceipt {
		t.Errorf("want dispute_amount_exceeds_receipt, got %+v", result)
	}
}

func TestValidateDisputeBadEvidenceScheme(t *testing.T) {
	signer := &mockSigner{address: payerAddress}
	verifier := &mockVerifier{returnAddress: payerAddress}
	payload := sampleDispute()
	payload.Evidence = []string{"ftp://server/evidence.json"}
	signed, _ := CreateSignedDispute(signer, payload, "")
	result, _ := ValidateDispute(ValidateDisputeInput{
		Verifier:        verifier,
		Dispute:         signed,
		ReceiptIssuedAt: nowUnix - 60,
		ReceiptHash:     sampleReceiptHsh,
		ReceiptAmount:   "1000000",
		Terms:           sampleTerms(),
		Now:             time.Unix(nowUnix, 0),
	})
	if result.Valid || result.Error != ErrDisputeEvidenceURIUnsupported {
		t.Errorf("want dispute_evidence_uri_unsupported, got %+v", result)
	}
}

// --- ValidateResolution ---

func TestValidateResolutionHappyPath(t *testing.T) {
	signer := &mockSigner{address: arbiterAddress}
	verifier := &mockVerifier{returnAddress: arbiterAddress}
	disputeSigner := &mockSigner{address: payerAddress}
	signedDispute, _ := CreateSignedDispute(disputeSigner, sampleDispute(), "")
	signedResolution, _ := CreateSignedResolution(signer, sampleResolution())
	result, _ := ValidateResolution(ValidateResolutionInput{
		Verifier:        verifier,
		Resolution:      signedResolution,
		Dispute:         signedDispute,
		DisputeHash:     sampleDisputeHsh,
		ExpectedArbiter: arbiterAddress,
	})
	if !result.Valid {
		t.Errorf("want valid, got %+v", result)
	}
}

func TestValidateResolutionWrongArbiterSig(t *testing.T) {
	signer := &mockSigner{address: arbiterAddress}
	verifier := &mockVerifier{returnAddress: "0xwrongarbiter"}
	disputeSigner := &mockSigner{address: payerAddress}
	signedDispute, _ := CreateSignedDispute(disputeSigner, sampleDispute(), "")
	signedResolution, _ := CreateSignedResolution(signer, sampleResolution())
	result, _ := ValidateResolution(ValidateResolutionInput{
		Verifier:        verifier,
		Resolution:      signedResolution,
		Dispute:         signedDispute,
		DisputeHash:     sampleDisputeHsh,
		ExpectedArbiter: arbiterAddress,
	})
	if result.Valid || result.Error != ErrResolutionInvalidSignature {
		t.Errorf("want resolution_invalid_signature, got %+v", result)
	}
}

func TestValidateResolutionUnknownDisputeHash(t *testing.T) {
	signer := &mockSigner{address: arbiterAddress}
	verifier := &mockVerifier{returnAddress: arbiterAddress}
	disputeSigner := &mockSigner{address: payerAddress}
	signedDispute, _ := CreateSignedDispute(disputeSigner, sampleDispute(), "")
	resPayload := sampleResolution()
	resPayload.DisputeHash = "0xwronghash" + strings.Repeat("0", 56)
	signedResolution, _ := CreateSignedResolution(signer, resPayload)
	result, _ := ValidateResolution(ValidateResolutionInput{
		Verifier:        verifier,
		Resolution:      signedResolution,
		Dispute:         signedDispute,
		DisputeHash:     sampleDisputeHsh,
		ExpectedArbiter: arbiterAddress,
	})
	if result.Valid || result.Error != ErrResolutionUnknownDispute {
		t.Errorf("want resolution_unknown_dispute, got %+v", result)
	}
}

func TestValidateResolutionArbiterPayloadMismatch(t *testing.T) {
	signer := &mockSigner{address: arbiterAddress}
	verifier := &mockVerifier{returnAddress: arbiterAddress}
	disputeSigner := &mockSigner{address: payerAddress}
	signedDispute, _ := CreateSignedDispute(disputeSigner, sampleDispute(), "")
	resPayload := sampleResolution()
	resPayload.Arbiter = "0xdifferent0000000000000000000000000000ab12"
	signedResolution, _ := CreateSignedResolution(signer, resPayload)
	result, _ := ValidateResolution(ValidateResolutionInput{
		Verifier:        verifier,
		Resolution:      signedResolution,
		Dispute:         signedDispute,
		DisputeHash:     sampleDisputeHsh,
		ExpectedArbiter: arbiterAddress,
	})
	if result.Valid || result.Error != ErrResolutionArbiterMismatch {
		t.Errorf("want resolution_arbiter_mismatch, got %+v", result)
	}
}

func TestValidateResolutionVerdictAmountInconsistent(t *testing.T) {
	signer := &mockSigner{address: arbiterAddress}
	verifier := &mockVerifier{returnAddress: arbiterAddress}
	disputeSigner := &mockSigner{address: payerAddress}
	signedDispute, _ := CreateSignedDispute(disputeSigner, sampleDispute(), "")
	resPayload := sampleResolution()
	resPayload.Verdict = VerdictDenied
	resPayload.SettledAmount = "1000000" // denied requires 0
	signedResolution, _ := CreateSignedResolution(signer, resPayload)
	result, _ := ValidateResolution(ValidateResolutionInput{
		Verifier:        verifier,
		Resolution:      signedResolution,
		Dispute:         signedDispute,
		DisputeHash:     sampleDisputeHsh,
		ExpectedArbiter: arbiterAddress,
	})
	if result.Valid || result.Error != ErrResolutionVerdictAmountInconsist {
		t.Errorf("want resolution_verdict_amount_inconsistent, got %+v", result)
	}
}

// --- Server utilities ---

func TestIsEvidenceURIAllowed(t *testing.T) {
	if !IsEvidenceURIAllowed("ipfs://hash", []string{"ipfs"}) {
		t.Error("ipfs scheme should be allowed")
	}
	if IsEvidenceURIAllowed("ftp://server", []string{"ipfs", "arweave"}) {
		t.Error("ftp scheme should not be allowed")
	}
	if IsEvidenceURIAllowed("no-colon-here", []string{"ipfs"}) {
		t.Error("URI without scheme should not be allowed")
	}
}

func TestIsReasonSupported(t *testing.T) {
	if !IsReasonSupported(ReasonNotDelivered, []DisputeReason{ReasonNotDelivered}) {
		t.Error("standard reason should be supported when listed")
	}
	if IsReasonSupported(ReasonNotDelivered, []DisputeReason{ReasonQualityIssue}) {
		t.Error("standard reason should not be supported when not listed")
	}
	if !IsReasonSupported("x_custom", []DisputeReason{"x_custom"}) {
		t.Error("x_ reason should be supported when listed")
	}
}

func TestPackageResolutionResponse(t *testing.T) {
	signer := &mockSigner{address: arbiterAddress}
	signedResolution, _ := CreateSignedResolution(signer, sampleResolution())
	pkg := PackageResolutionResponse(signedResolution)
	if pkg.Info.Resolution.Signature != signedResolution.Signature {
		t.Error("PackageResolutionResponse mismatch")
	}
}

// --- Facilitator ---

func TestFacilitatorHandlerArbiterAddress(t *testing.T) {
	handler := NewFacilitatorHandler(&mockSigner{address: arbiterAddress})
	if handler.GetArbiterAddress() != arbiterAddress {
		t.Errorf("want %s got %s", arbiterAddress, handler.GetArbiterAddress())
	}
}

func TestFacilitatorResolveDispute(t *testing.T) {
	handler := NewFacilitatorHandler(&mockSigner{address: arbiterAddress})
	signed, err := handler.ResolveDispute(FacilitatorResolveInput{
		DisputeHash:   sampleDisputeHsh,
		Verdict:       VerdictUpheldFull,
		SettledAmount: "1000000",
	})
	if err != nil {
		t.Fatalf("ResolveDispute: %v", err)
	}
	if signed.Payload.Arbiter != arbiterAddress {
		t.Errorf("payload.arbiter: want %s got %s", arbiterAddress, signed.Payload.Arbiter)
	}
	if signed.Payload.Verdict != VerdictUpheldFull {
		t.Error("payload.verdict mismatch")
	}
	if signed.Payload.DisputeHash != sampleDisputeHsh {
		t.Error("payload.disputeHash mismatch")
	}
}

func TestBuildFacilitatorResolution(t *testing.T) {
	handler := NewFacilitatorHandler(&mockSigner{address: arbiterAddress})
	signed, err := BuildFacilitatorResolution(handler, sampleDisputeHsh, VerdictDenied, "0", "")
	if err != nil {
		t.Fatalf("BuildFacilitatorResolution: %v", err)
	}
	if signed.Payload.Verdict != VerdictDenied || signed.Payload.SettledAmount != "0" {
		t.Errorf("unexpected payload: %+v", signed.Payload)
	}
}
