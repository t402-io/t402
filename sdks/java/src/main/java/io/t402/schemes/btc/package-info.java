/**
 * Bitcoin and Lightning Network payment mechanism for T402.
 *
 * <p>Provides client, server, and facilitator implementations for:
 * <ul>
 *   <li><b>Bitcoin on-chain</b> — PSBT (Partially Signed Bitcoin Transactions)
 *       with the "exact" scheme on {@code bip122:*} networks</li>
 *   <li><b>Lightning Network</b> — BOLT11 invoice payments with preimage
 *       verification on {@code lightning:*} networks</li>
 * </ul>
 *
 * <h2>Supported Networks</h2>
 * <table>
 *   <tr><th>Network</th><th>CAIP-2</th></tr>
 *   <tr><td>Bitcoin Mainnet</td><td>{@code bip122:000000000019d6689c085ae165831e93}</td></tr>
 *   <tr><td>Bitcoin Testnet</td><td>{@code bip122:000000000933ea01ad0ee984209779ba}</td></tr>
 *   <tr><td>Lightning Mainnet</td><td>{@code lightning:mainnet}</td></tr>
 *   <tr><td>Lightning Testnet</td><td>{@code lightning:testnet}</td></tr>
 * </table>
 *
 * @see io.t402.schemes.btc.exact.ExactBtcClientScheme
 * @see io.t402.schemes.btc.exact.ExactBtcServerScheme
 * @see io.t402.schemes.btc.exact.ExactBtcFacilitatorScheme
 * @see io.t402.schemes.btc.lightning.LightningClientScheme
 * @see io.t402.schemes.btc.lightning.LightningFacilitatorScheme
 */
package io.t402.schemes.btc;
