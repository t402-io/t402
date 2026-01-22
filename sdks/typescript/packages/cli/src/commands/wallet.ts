import { Command } from "commander";
import chalk from "chalk";
import {
  hasSeedConfigured,
  storeSeed,
  getEncryptedSeed,
  clearSeed,
  getConfig,
} from "../config/index.js";
import {
  createSpinner,
  formatAmount,
  printSuccess,
  printError,
  printWarning,
  printHeader,
  printTable,
  isValidSeedPhrase,
  encryptSeed,
  decryptSeed,
  getNetworkName,
} from "../utils/index.js";

// Machine ID for basic encryption key
const MACHINE_KEY = `t402-cli-${process.env.USER || "default"}`;

/**
 * Register wallet-related commands
 */
export function registerWalletCommands(program: Command): void {
  const wallet = program.command("wallet").description("Wallet management commands");

  // wallet create
  wallet
    .command("create")
    .description("Create a new wallet with a generated seed phrase")
    .action(async () => {
      if (hasSeedConfigured()) {
        printWarning("A wallet is already configured. Use 'wallet clear' first to remove it.");
        return;
      }

      try {
        // Use viem for seed phrase generation
        const { generateMnemonic, english } = await import("viem/accounts");

        const spinner = createSpinner("Generating seed phrase...").start();
        const mnemonic = generateMnemonic(english);
        spinner.succeed("Seed phrase generated");

        console.log();
        console.log(chalk.yellow("⚠  IMPORTANT: Write down these words and store them safely!"));
        console.log(chalk.yellow("   This is the ONLY way to recover your wallet."));
        console.log();
        console.log(chalk.bold("Seed phrase:"));
        console.log();
        console.log(`  ${chalk.cyan(mnemonic)}`);
        console.log();

        // Store encrypted seed
        const encrypted = encryptSeed(mnemonic, MACHINE_KEY);
        storeSeed(encrypted);

        printSuccess("Wallet created and saved to config");
        console.log();
        console.log("Run 'wallet show' to see your addresses.");
      } catch (error) {
        printError(`Failed to create wallet: ${error instanceof Error ? error.message : error}`);
      }
    });

  // wallet import
  wallet
    .command("import")
    .description("Import an existing wallet from a seed phrase")
    .argument("<seed-phrase>", "12 or 24 word seed phrase (in quotes)")
    .action(async (seedPhrase: string) => {
      if (hasSeedConfigured()) {
        printWarning("A wallet is already configured. Use 'wallet clear' first to remove it.");
        return;
      }

      const phrase = seedPhrase.trim();
      if (!isValidSeedPhrase(phrase)) {
        printError("Invalid seed phrase. Must be 12 or 24 words.");
        return;
      }

      try {
        // Validate by trying to create an account
        const { mnemonicToAccount } = await import("viem/accounts");
        mnemonicToAccount(phrase); // Throws if invalid

        // Store encrypted seed
        const encrypted = encryptSeed(phrase, MACHINE_KEY);
        storeSeed(encrypted);

        printSuccess("Wallet imported successfully");
        console.log();
        console.log("Run 'wallet show' to see your addresses.");
      } catch (error) {
        printError(`Failed to import wallet: ${error instanceof Error ? error.message : error}`);
      }
    });

  // wallet show
  wallet
    .command("show")
    .description("Show wallet addresses")
    .action(async () => {
      const encrypted = getEncryptedSeed();
      if (!encrypted) {
        printError("No wallet configured. Run 'wallet create' or 'wallet import' first.");
        return;
      }

      try {
        const seedPhrase = decryptSeed(encrypted, MACHINE_KEY);
        const { mnemonicToAccount } = await import("viem/accounts");

        const spinner = createSpinner("Loading wallet...").start();
        const account = mnemonicToAccount(seedPhrase);
        spinner.succeed("Wallet loaded");

        printHeader("Wallet Addresses");

        const addresses: Record<string, string> = {
          "EVM (Ethereum, Arbitrum, Base, etc.)": account.address,
        };

        printTable(addresses);

        console.log();
        console.log(chalk.gray("Note: Install @t402/wdk for full multi-chain support"));
      } catch (error) {
        printError(`Failed to load wallet: ${error instanceof Error ? error.message : error}`);
      }
    });

  // wallet balance
  wallet
    .command("balance")
    .description("Check wallet balances")
    .option("-n, --network <network>", "Specific network to check (e.g., eip155:8453)")
    .option("-a, --all", "Show all networks including zero balances")
    .action(async (options: { network?: string; all?: boolean }) => {
      const encrypted = getEncryptedSeed();
      if (!encrypted) {
        printError("No wallet configured. Run 'wallet create' or 'wallet import' first.");
        return;
      }

      try {
        const seedPhrase = decryptSeed(encrypted, MACHINE_KEY);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wdkModule: any = await import("@t402/wdk");
        const { T402WDK } = wdkModule;

        const spinner = createSpinner("Fetching balances...").start();
        const testnet = getConfig("testnet");

        // Create WDK with appropriate chains
        const chainConfig = testnet
          ? {
              "arbitrum-sepolia": "https://sepolia-rollup.arbitrum.io/rpc",
              "base-sepolia": "https://sepolia.base.org",
            }
          : {
              arbitrum: "https://arb1.arbitrum.io/rpc",
              base: "https://mainnet.base.org",
            };

        const wdk = new T402WDK(seedPhrase, chainConfig);

        if (options.network) {
          // Single network balance
          const chainName = options.network.replace("eip155:", "").replace("8453", "base").replace("42161", "arbitrum");
          spinner.text = `Fetching balance for ${getNetworkName(options.network)}...`;
          const balance = await wdk.getUsdt0Balance(chainName);
          spinner.succeed("Balance fetched");

          printHeader(`Balance on ${getNetworkName(options.network)}`);
          console.log(`  ${chalk.green(formatAmount(balance.toString()))} USDT0`);
        } else {
          // All balances
          const balances = await wdk.getAggregatedBalances();
          spinner.succeed("Balances fetched");

          printHeader("Wallet Balances");
          console.log(`  Total USDT0: ${chalk.green(formatAmount(balances.totalUsdt0.toString()))}`);

          if (balances.chains.length > 0) {
            console.log();
            for (const chain of balances.chains) {
              const usdt0 = chain.tokens.find((t: { symbol: string }) => t.symbol === "USDT0");
              if (usdt0 && (options.all || usdt0.balance > 0n)) {
                const color = usdt0.balance > 0n ? chalk.green : chalk.gray;
                console.log(`  ${chain.chain.padEnd(20)} ${color(formatAmount(usdt0.balance.toString()))} USDT0`);
              }
            }
          }
        }
      } catch (error) {
        printError(`Failed to fetch balances: ${error instanceof Error ? error.message : error}`);
      }
    });

  // wallet clear
  wallet
    .command("clear")
    .description("Remove wallet from this device")
    .option("-f, --force", "Skip confirmation")
    .action(async (options: { force?: boolean }) => {
      if (!hasSeedConfigured()) {
        printWarning("No wallet configured.");
        return;
      }

      if (!options.force) {
        console.log(chalk.yellow("⚠  WARNING: This will remove your wallet from this device."));
        console.log(chalk.yellow("   Make sure you have your seed phrase backed up!"));
        console.log();
        console.log("Run with --force to confirm.");
        return;
      }

      clearSeed();
      printSuccess("Wallet removed from this device");
    });

  // wallet export
  wallet
    .command("export")
    .description("Export seed phrase (use with caution!)")
    .option("-f, --force", "Skip warning")
    .action(async (options: { force?: boolean }) => {
      const encrypted = getEncryptedSeed();
      if (!encrypted) {
        printError("No wallet configured.");
        return;
      }

      if (!options.force) {
        console.log(chalk.red("⚠  DANGER: This will display your seed phrase on screen!"));
        console.log(chalk.red("   Anyone who sees this can steal your funds."));
        console.log();
        console.log("Run with --force to proceed.");
        return;
      }

      const seedPhrase = decryptSeed(encrypted, MACHINE_KEY);
      console.log();
      console.log(chalk.bold("Seed phrase:"));
      console.log();
      console.log(`  ${chalk.cyan(seedPhrase)}`);
      console.log();
    });
}
