package main

import (
	t402 "github.com/coinbase/t402/go"
	evm "github.com/coinbase/t402/go/mechanisms/evm/exact/client"
	svm "github.com/coinbase/t402/go/mechanisms/svm/exact/client"
	evmsigners "github.com/coinbase/t402/go/signers/evm"
	svmsigners "github.com/coinbase/t402/go/signers/svm"
)

/**
 * Mechanism Helper Registration Client
 *
 * This demonstrates a convenient pattern using mechanism helpers with wildcard
 * network registration for clean, readable client configuration.
 *
 * This approach is simpler than the builder pattern when you want to register
 * all networks of a particular type with the same signer.
 */

func createMechanismHelperRegistrationClient(evmPrivateKey, svmPrivateKey string) (*t402.T402Client, error) {
	// Create signers from private keys
	evmSigner, err := evmsigners.NewClientSignerFromPrivateKey(evmPrivateKey)
	if err != nil {
		return nil, err
	}

	// Start with a new client
	client := t402.Newt402Client()

	// Register EVM scheme for all EVM networks using wildcard
	// This registers:
	// - eip155:* (all EVM networks in v2)
	client.Register("eip155:*", evm.NewExactEvmScheme(evmSigner))

	// Register SVM scheme if key is provided
	if svmPrivateKey != "" {
		svmSigner, err := svmsigners.NewClientSignerFromPrivateKey(svmPrivateKey)
		if err != nil {
			return nil, err
		}

		// Register for all Solana networks using wildcard
		// This registers:
		// - solana:* (all Solana networks in v2)
		client.Register("solana:*", svm.NewExactSvmScheme(svmSigner))
	}

	// The fluent API allows chaining for clean code:
	// client := t402.Newt402Client().
	//     Register("eip155:*", evm.NewExactEvmScheme(evmSigner)).
	//     Register("solana:*", svm.NewExactSvmScheme(svmSigner))

	return client, nil
}

