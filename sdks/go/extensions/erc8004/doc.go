/*
Package erc8004 provides ERC-8004 Trustless Agents extension types and utilities
for the t402 protocol.

ERC-8004 defines a standard for trustless AI agent identity on Ethereum. This
package integrates ERC-8004 with the t402 payment protocol, enabling:

  - Identity Resolution: resolve agent addresses to on-chain identities via the Identity Registry
  - Reputation Scoring: query and submit feedback for agents via the Reputation Registry
  - Validation Registry: submit and check validation requests for agent transactions
  - Payment Extensions: declare and verify ERC-8004 identity in t402 payment flows

# Extension Declaration (Server)

Servers declare ERC-8004 support in PaymentRequired extensions:

	import "github.com/t402-io/t402/sdks/go/extensions/erc8004"

	ext := erc8004.DeclareExtension(42, "eip155:8453:0x742d35Cc...")

	routes := t402http.RoutesConfig{
	    "GET /api/data": {
	        Accepts: t402http.PaymentOptions{...},
	        Extensions: map[string]interface{}{
	            erc8004.ExtensionKey: ext,
	        },
	    },
	}

# Extension Extraction (Client/Facilitator)

	ext, err := erc8004.ParseExtension(extensions)
	if err != nil {
	    // No ERC-8004 extension present
	}
	fmt.Printf("Agent %d on registry %s\n", ext.AgentID, ext.AgentRegistry)

# Identity Resolution

	registry := erc8004.ParseAgentRegistry("eip155:8453:0x742d35Cc...")
	// registry.Namespace = "eip155", registry.ChainID = "8453", registry.Address = "0x742d35Cc..."

# Reputation

	summary, err := erc8004.ParseReputationSummary(rawData)
	fmt.Printf("Score: %d, Feedback count: %d\n", summary.NormalizedScore, summary.Count)
*/
package erc8004
