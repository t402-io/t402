/**
 * Spark (Bitcoin L2) payment mechanism for T402.
 *
 * <p>Spark is a Bitcoin L2 with instant transfers. This mechanism enables
 * machine-to-machine payments over HTTP using Spark as the settlement layer.
 *
 * <h2>Supported Payment Types</h2>
 * <ul>
 *   <li><b>Spark</b> — Direct Spark transfer, verified by transfer_id lookup</li>
 *   <li><b>Lightning</b> — Lightning Network payment routed through Spark,
 *       verified by SHA256(preimage) === payment_hash</li>
 * </ul>
 *
 * <h2>Supported Networks</h2>
 * <table>
 *   <tr><th>Network</th><th>CAIP-2</th></tr>
 *   <tr><td>Spark Mainnet</td><td>{@code spark:mainnet}</td></tr>
 *   <tr><td>Spark Testnet</td><td>{@code spark:testnet}</td></tr>
 * </table>
 *
 * @see io.t402.schemes.spark.exact.SparkFacilitatorScheme
 */
package io.t402.schemes.spark;
