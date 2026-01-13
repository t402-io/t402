import { Command } from "commander";
import chalk from "chalk";
import { getEncryptedSeed, getConfig } from "../config/index.js";
import {
  createSpinner,
  formatAddress,
  formatAmount,
  printSuccess,
  printError,
  printWarning,
  printHeader,
  printTable,
  decryptSeed,
  getNetworkName,
  isValidUrl,
} from "../utils/index.js";

// Machine ID for basic encryption key
const MACHINE_KEY = `t402-cli-${process.env.USER || "default"}`;

/**
 * Register the request command
 */
export function registerRequestCommand(program: Command): void {
  program
    .command("request")
    .description("Make an HTTP request with automatic 402 payment handling")
    .argument("<url>", "URL to request")
    .option("-X, --method <method>", "HTTP method", "GET")
    .option("-H, --header <header...>", "Additional headers (key:value)")
    .option("-d, --data <data>", "Request body data")
    .option("-g, --gasless", "Use gasless payments (ERC-4337)")
    .option("-n, --network <network>", "Preferred network for payment")
    .option("-o, --output <file>", "Save response to file")
    .option("-v, --verbose", "Show detailed output")
    .option("--dry-run", "Show what would be paid without executing")
    .action(
      async (
        url: string,
        options: {
          method: string;
          header?: string[];
          data?: string;
          gasless?: boolean;
          network?: string;
          output?: string;
          verbose?: boolean;
          dryRun?: boolean;
        },
      ) => {
        if (!isValidUrl(url)) {
          printError("Invalid URL format");
          return;
        }

        const encrypted = getEncryptedSeed();
        if (!encrypted && !options.dryRun) {
          printError("No wallet configured. Run 'wallet create' or 'wallet import' first.");
          return;
        }

        // Build request options
        const headers: Record<string, string> = {
          "User-Agent": "t402-cli/2.0.0",
        };

        if (options.header) {
          for (const h of options.header) {
            const [key, ...valueParts] = h.split(":");
            if (key && valueParts.length > 0) {
              headers[key.trim()] = valueParts.join(":").trim();
            }
          }
        }

        const fetchOptions: RequestInit = {
          method: options.method,
          headers,
        };

        if (options.data) {
          fetchOptions.body = options.data;
          if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
          }
        }

        try {
          const spinner = createSpinner(`${options.method} ${url}`).start();

          // Make initial request
          const response = await fetch(url, fetchOptions);

          if (response.status === 402) {
            spinner.info("Payment required (402)");

            // Parse 402 response
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
              printError("Invalid 402 response format");
              return;
            }

            // Select payment option
            const preferredNetwork = options.network || getConfig("defaultNetwork");
            let requirement = paymentRequired.accepts.find(
              (r) => r.network === preferredNetwork,
            );
            if (!requirement) {
              requirement = paymentRequired.accepts[0];
            }

            printHeader("Payment Required");
            printTable({
              Resource: paymentRequired.resource?.description || url,
              Amount: `${formatAmount(requirement.amount)} ${requirement.asset?.toUpperCase() || "USDT"}`,
              Network: getNetworkName(requirement.network),
              Recipient: formatAddress(requirement.payTo),
            });
            console.log();

            if (options.dryRun) {
              printWarning("Dry run - no payment executed");
              return;
            }

            if (!encrypted) {
              printError("No wallet configured.");
              return;
            }

            const seedPhrase = decryptSeed(encrypted, MACHINE_KEY);
            const paySpinner = createSpinner("Processing payment...").start();

            let paymentProof: string;

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

              paymentProof = result.userOpHash;
              paySpinner.succeed("Gasless payment sent");

              if (options.verbose) {
                console.log(`  User Operation Hash: ${chalk.cyan(result.userOpHash)}`);
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

              paymentProof = txHash;
              paySpinner.succeed("Payment sent");

              if (options.verbose) {
                console.log(`  Transaction Hash: ${chalk.cyan(txHash)}`);
              }
            }

            // Retry with payment header
            console.log();
            const retrySpinner = createSpinner("Retrying request with payment proof...").start();

            const retryResponse = await fetch(url, {
              ...fetchOptions,
              headers: {
                ...headers,
                "X-Payment": paymentProof,
              },
            });

            if (retryResponse.ok) {
              retrySpinner.succeed(`${retryResponse.status} ${retryResponse.statusText}`);
              await handleResponse(retryResponse, options);
            } else if (retryResponse.status === 402) {
              retrySpinner.fail("Payment not accepted - still requires payment");
              printError("The server did not accept the payment proof.");
            } else {
              retrySpinner.warn(`${retryResponse.status} ${retryResponse.statusText}`);
              await handleResponse(retryResponse, options);
            }
          } else if (response.ok) {
            spinner.succeed(`${response.status} ${response.statusText}`);
            await handleResponse(response, options);
          } else {
            spinner.fail(`${response.status} ${response.statusText}`);
            await handleResponse(response, options);
          }
        } catch (error) {
          printError(`Request failed: ${error instanceof Error ? error.message : error}`);
        }
      },
    );
}

/**
 * Handle and display response
 */
async function handleResponse(
  response: Response,
  options: { output?: string; verbose?: boolean },
): Promise<void> {
  const contentType = response.headers.get("content-type") || "";

  if (options.verbose) {
    console.log();
    console.log(chalk.gray("Response Headers:"));
    response.headers.forEach((value, key) => {
      console.log(chalk.gray(`  ${key}: ${value}`));
    });
    console.log();
  }

  if (options.output) {
    const { writeFile } = await import("fs/promises");
    const buffer = await response.arrayBuffer();
    await writeFile(options.output, Buffer.from(buffer));
    printSuccess(`Response saved to ${options.output}`);
  } else if (contentType.includes("application/json")) {
    const json = await response.json();
    console.log();
    console.log(JSON.stringify(json, null, 2));
  } else if (contentType.includes("text/")) {
    const text = await response.text();
    console.log();
    console.log(text);
  } else {
    const size = response.headers.get("content-length") || "unknown";
    console.log();
    console.log(chalk.gray(`Binary response (${size} bytes)`));
    console.log(chalk.gray("Use --output to save to file"));
  }
}
