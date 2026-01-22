import { Command } from "commander";
import chalk from "chalk";
import { getConfig } from "../config/index.js";
import { printHeader } from "../utils/index.js";
import { NETWORKS } from "../types.js";
import { VERSION } from "../version.js";

/**
 * Register info command
 */
export function registerInfoCommand(program: Command): void {
  program
    .command("info")
    .description("Show supported networks and assets")
    .option("-a, --all", "Show all networks (mainnet and testnet)")
    .option("-t, --testnet", "Show testnet networks only")
    .action((options: { all?: boolean; testnet?: boolean }) => {
      const showTestnet = options.testnet || getConfig("testnet");
      const showAll = options.all;

      printHeader("T402 Payment Protocol");

      console.log(`  Version: ${VERSION}`);
      console.log("  Facilitator: " + chalk.cyan(getConfig("facilitatorUrl")));
      console.log();

      // Supported Networks
      console.log(chalk.bold("Supported Networks:"));
      console.log();

      // EVM Networks
      const evmMainnets = NETWORKS.filter((n) => n.type === "evm" && !n.testnet);
      const evmTestnets = NETWORKS.filter((n) => n.type === "evm" && n.testnet);

      if (showAll || !showTestnet) {
        console.log(chalk.underline("  EVM (Mainnet):"));
        for (const network of evmMainnets) {
          console.log(
            `    ${chalk.green("●")} ${network.name.padEnd(16)} ${chalk.gray(network.id)}`,
          );
        }
        console.log();
      }

      if (showAll || showTestnet) {
        console.log(chalk.underline("  EVM (Testnet):"));
        for (const network of evmTestnets) {
          console.log(
            `    ${chalk.yellow("●")} ${network.name.padEnd(16)} ${chalk.gray(network.id)}`,
          );
        }
        console.log();
      }

      // Solana
      const solanaNetworks = NETWORKS.filter(
        (n) => n.type === "solana" && (showAll || n.testnet === showTestnet),
      );
      if (solanaNetworks.length > 0) {
        console.log(chalk.underline("  Solana:"));
        for (const network of solanaNetworks) {
          const color = network.testnet ? chalk.yellow : chalk.green;
          console.log(`    ${color("●")} ${network.name.padEnd(16)} ${chalk.gray(network.id)}`);
        }
        console.log();
      }

      // TON
      const tonNetworks = NETWORKS.filter(
        (n) => n.type === "ton" && (showAll || n.testnet === showTestnet),
      );
      if (tonNetworks.length > 0) {
        console.log(chalk.underline("  TON:"));
        for (const network of tonNetworks) {
          const color = network.testnet ? chalk.yellow : chalk.green;
          console.log(`    ${color("●")} ${network.name.padEnd(16)} ${chalk.gray(network.id)}`);
        }
        console.log();
      }

      // TRON
      const tronNetworks = NETWORKS.filter(
        (n) => n.type === "tron" && (showAll || n.testnet === showTestnet),
      );
      if (tronNetworks.length > 0) {
        console.log(chalk.underline("  TRON:"));
        for (const network of tronNetworks) {
          const color = network.testnet ? chalk.yellow : chalk.green;
          console.log(`    ${color("●")} ${network.name.padEnd(16)} ${chalk.gray(network.id)}`);
        }
        console.log();
      }

      // Supported Assets
      console.log(chalk.bold("Supported Assets:"));
      console.log();
      console.log(`  ${chalk.cyan("USDT0")}  - Tether USD (OFT) on EVM chains`);
      console.log(`  ${chalk.cyan("USDT")}   - Tether USD on all chains`);
      console.log();

      // Payment Schemes
      console.log(chalk.bold("Payment Schemes:"));
      console.log();
      console.log(`  ${chalk.magenta("exact")}  - Exact amount payment (default)`);
      console.log(`  ${chalk.magenta("upto")}   - Payment up to specified amount`);
      console.log();

      // Features
      console.log(chalk.bold("Features:"));
      console.log();
      console.log(`  ${chalk.green("✓")} Standard payments (all chains)`);
      console.log(`  ${chalk.green("✓")} Gasless payments via ERC-4337 (EVM chains)`);
      console.log(`  ${chalk.green("✓")} Cross-chain bridging via LayerZero`);
      console.log(`  ${chalk.green("✓")} WDK wallet integration`);
      console.log();

      // Legend
      console.log(chalk.gray("Legend:"));
      console.log(chalk.gray(`  ${chalk.green("●")} Mainnet  ${chalk.yellow("●")} Testnet`));
    });

  // version command (alias)
  program
    .command("version")
    .description("Show CLI version")
    .action(() => {
      console.log(`t402 CLI v${VERSION}`);
    });
}
