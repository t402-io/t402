import { Command } from "commander";
import chalk from "chalk";
import { getEncryptedSeed, getConfig } from "../config/index.js";
import {
  createSpinner,
  formatAddress,
  formatAmount,
  parseAmount,
  printSuccess,
  printError,
  printHeader,
  printTable,
  decryptSeed,
  getNetworkName,
  isValidUrl,
} from "../utils/index.js";

// Machine ID for basic encryption key
const MACHINE_KEY = `t402-cli-${process.env.USER || "default"}`;

/**
 * Register payment-related commands
 */
export function registerPayCommands(program: Command): void {
  // pay command
  program
    .command("pay")
    .description("Send a payment to an address")
    .argument("<to>", "Recipient address")
    .argument("<amount>", "Amount to send (e.g., 1.5)")
    .option("-n, --network <network>", "Network to use (e.g., eip155:8453)")
    .option("-a, --asset <asset>", "Asset to send (default: usdt0)", "usdt0")
    .option("-g, --gasless", "Use gasless transaction (ERC-4337)")
    .action(
      async (
        to: string,
        amount: string,
        options: { network?: string; asset: string; gasless?: boolean },
      ) => {
        const encrypted = getEncryptedSeed();
        if (!encrypted) {
          printError("No wallet configured. Run 'wallet create' or 'wallet import' first.");
          return;
        }

        const network = options.network || getConfig("defaultNetwork");
        const testnet = getConfig("testnet");

        // Validate network matches testnet setting
        const isTestnetNetwork =
          network.includes("sepolia") ||
          network.includes("testnet") ||
          network.includes("devnet") ||
          network.includes("nile") ||
          network === "ton:-3";
        if (testnet !== isTestnetNetwork) {
          printError(
            `Network ${network} doesn't match testnet mode (${testnet ? "testnet" : "mainnet"}).`,
          );
          printError(`Run 'config set testnet ${isTestnetNetwork}' to switch modes.`);
          return;
        }

        try {
          const seedPhrase = decryptSeed(encrypted, MACHINE_KEY);

          printHeader("Payment Details");
          printTable({
            To: formatAddress(to),
            Amount: `${amount} ${options.asset.toUpperCase()}`,
            Network: getNetworkName(network),
            Mode: options.gasless ? "Gasless (ERC-4337)" : "Standard",
          });
          console.log();

          const spinner = createSpinner("Preparing transaction...").start();

          if (options.gasless) {
            // Gasless payment using ERC-4337
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wdkGasless: any = await import("@t402/wdk-gasless");
            const { WdkGaslessClient } = wdkGasless;

            spinner.text = "Initializing gasless client...";
            const client = await WdkGaslessClient.create({
              seedPhrase,
              chain: network.replace("eip155:", ""),
            });

            spinner.text = "Sending gasless payment...";
            const result = await client.pay({
              to,
              amount: parseAmount(amount),
            });

            spinner.succeed("Payment sent!");
            console.log();
            printSuccess("Transaction submitted");
            console.log(`  User Operation Hash: ${chalk.cyan(result.userOpHash)}`);
            if (result.txHash) {
              console.log(`  Transaction Hash: ${chalk.cyan(result.txHash)}`);
            }
          } else {
            // Standard payment
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wdk: any = await import("@t402/wdk");
            const { createPaymentProcessor } = wdk;

            spinner.text = "Initializing wallet...";
            const processor = createPaymentProcessor({ seedPhrase });
            await processor.initialize();

            spinner.text = "Sending payment...";
            const txHash = await processor.pay({
              network,
              asset: options.asset,
              to,
              amount: parseAmount(amount),
            });

            spinner.succeed("Payment sent!");
            console.log();
            printSuccess("Transaction submitted");
            console.log(`  Transaction Hash: ${chalk.cyan(txHash)}`);
          }
        } catch (error) {
          printError(`Payment failed: ${error instanceof Error ? error.message : error}`);
        }
      },
    );

  // pay-invoice command (pay a 402 response)
  program
    .command("pay-invoice")
    .description("Pay a 402 Payment Required response")
    .argument("<url>", "URL that returned 402")
    .option("-g, --gasless", "Use gasless transaction (ERC-4337)")
    .option("-i, --index <index>", "Payment option index (if multiple)", "0")
    .action(async (url: string, options: { gasless?: boolean; index: string }) => {
      if (!isValidUrl(url)) {
        printError("Invalid URL format");
        return;
      }

      const encrypted = getEncryptedSeed();
      if (!encrypted) {
        printError("No wallet configured. Run 'wallet create' or 'wallet import' first.");
        return;
      }

      try {
        const spinner = createSpinner("Fetching payment requirements...").start();

        // Fetch the 402 response
        const response = await fetch(url);
        if (response.status !== 402) {
          spinner.fail(`Expected 402 status, got ${response.status}`);
          return;
        }

        const paymentRequired = (await response.json()) as {
          accepts?: Array<{
            network: string;
            asset?: string;
            amount: string;
            payTo: string;
          }>;
          resource?: { description?: string };
        };
        if (!paymentRequired.accepts || !Array.isArray(paymentRequired.accepts)) {
          spinner.fail("Invalid 402 response format");
          return;
        }

        const index = parseInt(options.index, 10);
        const requirement = paymentRequired.accepts[index];
        if (!requirement) {
          spinner.fail(`No payment option at index ${index}`);
          return;
        }

        spinner.succeed("Payment requirements fetched");

        printHeader("Payment Requirements");
        printTable({
          Resource: paymentRequired.resource?.description || url,
          Amount: `${formatAmount(requirement.amount)} ${requirement.asset?.toUpperCase() || "USDT"}`,
          Network: getNetworkName(requirement.network),
          Recipient: formatAddress(requirement.payTo),
        });
        console.log();

        const seedPhrase = decryptSeed(encrypted, MACHINE_KEY);
        const paySpinner = createSpinner("Processing payment...").start();

        if (options.gasless) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const wdkGasless: any = await import("@t402/wdk-gasless");
          const { WdkGaslessClient } = wdkGasless;

          paySpinner.text = "Initializing gasless client...";
          const client = await WdkGaslessClient.create({
            seedPhrase,
            chain: requirement.network.replace("eip155:", ""),
          });

          paySpinner.text = "Sending gasless payment...";
          const result = await client.pay({
            to: requirement.payTo,
            amount: requirement.amount,
          });

          paySpinner.succeed("Payment sent!");
          console.log();
          printSuccess("Payment completed");
          console.log(`  User Operation Hash: ${chalk.cyan(result.userOpHash)}`);

          // Retry the original request with payment header
          console.log();
          const retrySpinner = createSpinner("Retrying request with payment...").start();

          const retryResponse = await fetch(url, {
            headers: {
              "X-Payment": result.userOpHash,
            },
          });

          if (retryResponse.ok) {
            retrySpinner.succeed("Request successful!");
            console.log(`  Status: ${chalk.green(retryResponse.status)}`);
          } else {
            retrySpinner.warn(`Request returned ${retryResponse.status}`);
          }
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const wdk: any = await import("@t402/wdk");
          const { createPaymentProcessor } = wdk;

          paySpinner.text = "Initializing wallet...";
          const processor = createPaymentProcessor({ seedPhrase });
          await processor.initialize();

          paySpinner.text = "Sending payment...";
          const txHash = await processor.pay({
            network: requirement.network,
            asset: requirement.asset || "usdt",
            to: requirement.payTo,
            amount: requirement.amount,
          });

          paySpinner.succeed("Payment sent!");
          console.log();
          printSuccess("Payment completed");
          console.log(`  Transaction Hash: ${chalk.cyan(txHash)}`);
        }
      } catch (error) {
        printError(`Failed to pay invoice: ${error instanceof Error ? error.message : error}`);
      }
    });
}
