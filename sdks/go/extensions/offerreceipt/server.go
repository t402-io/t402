package offerreceipt

import "time"

// ServerConfig configures the offer-receipt server extension.
type ServerConfig struct {
	Signer               Signer
	ResourceURL          string
	OfferValiditySeconds int64 // 0 = no expiry
}

// AcceptedMethod describes one accepted payment method.
type AcceptedMethod struct {
	Scheme  string
	Network string
	Asset   string
	PayTo   string
	Amount  string
}

// CreateOffersFromRequirements creates signed offers for each accepted payment method.
func CreateOffersFromRequirements(config *ServerConfig, accepts []AcceptedMethod) ([]SignedOffer, error) {
	now := time.Now().Unix()
	var validUntil int64
	if config.OfferValiditySeconds > 0 {
		validUntil = now + config.OfferValiditySeconds
	}

	offers := make([]SignedOffer, 0, len(accepts))

	for i, a := range accepts {
		payload := &OfferPayload{
			Version:     1,
			ResourceURL: config.ResourceURL,
			Scheme:      a.Scheme,
			Network:     a.Network,
			Asset:       a.Asset,
			PayTo:       a.PayTo,
			Amount:      a.Amount,
			ValidUntil:  validUntil,
		}

		idx := i
		offer, err := CreateSignedOffer(config.Signer, payload, &idx)
		if err != nil {
			return nil, err
		}
		offers = append(offers, *offer)
	}

	return offers, nil
}

// CreateReceiptForPayment creates a signed receipt after successful payment.
func CreateReceiptForPayment(config *ServerConfig, network, payer, transaction string) (*SignedReceipt, error) {
	payload := &ReceiptPayload{
		Version:     1,
		Network:     network,
		ResourceURL: config.ResourceURL,
		Payer:       payer,
		IssuedAt:    time.Now().Unix(),
		Transaction: transaction,
	}

	return CreateSignedReceipt(config.Signer, payload)
}
