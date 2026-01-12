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
  formatAddress,
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
  getAvailableNetworks,
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
        // Dynamic import to avoid loading WDK unless needed
        const { generateMnemonic } = await import("@t402/wdk");

        const spinner = createSpinner("Generating seed phrase...").start();
        const mnemonic = generateMnemonic();
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
        // Validate by trying to create a signer
        const { WDKSigner } = await import("@t402/wdk");
        const signer = new WDKSigner({ seedPhrase: phrase });
        await signer.initialize();

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
        const { WDKSigner } = await import("@t402/wdk");

        const spinner = createSpinner("Loading wallet...").start();
        const signer = new WDKSigner({ seedPhrase });
        await signer.initialize();
        spinner.succeed("Wallet loaded");

        printHeader("Wallet Addresses");

        const addresses: Record<string, string> = {};

        // EVM address
        const evmAddress = signer.getAddress("evm");
        if (evmAddress) {
          addresses["EVM (Ethereum, Arbitrum, Base, etc.)"] = evmAddress;
        }

        // Solana address
        const solanaAddress = signer.getAddress("solana");
        if (solanaAddress) {
          addresses["Solana"] = solanaAddress;
        }

        // TON address
        const tonAddress = signer.getAddress("ton");
        if (tonAddress) {
          addresses["TON"] = tonAddress;
        }

        // TRON address
        const tronAddress = signer.getAddress("tron");
        if (tronAddress) {
          addresses["TRON"] = tronAddress;
        }

        printTable(addresses);
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
        const { WDKSigner } = await import("@t402/wdk");

        const spinner = createSpinner("Fetching balances...").start();
        const testnet = getConfig("testnet");

        // Create signer with appropriate chains
        const signer = new WDKSigner({
          seedPhrase,
          chains: testnet
            ? {
                "arbitrum-sepolia": "https://sepolia-rollup.arbitrum.io/rpc",
                "base-sepolia": "https://sepolia.base.org",
              }
            : {
                arbitrum: "https://arb1.arbitrum.io/rpc",
                base: "https://mainnet.base.org",
              },
        });
        await signer.initialize();

        if (options.network) {
          // Single network balance
          spinner.text = `Fetching balance for ${getNetworkName(options.network)}...`;
          const balance = await signer.getBalance(options.network);
          spinner.succeed("Balance fetched");

          printHeader(`Balance on ${getNetworkName(options.network)}`);
          console.log(`  ${chalk.green(formatAmount(balance.toString()))} USDT`);
        } else {
          // All balances
          const balances = await signer.getAllBalances();
          spinner.succeed("Balances fetched");

          printHeader("Wallet Balances");

          const networks = getAvailableNetworks(testnet);
          let hasNonZero = false;

          for (const network of networks) {
            const balance = balances[network.id];
            if (balance !== undefined) {
              const formatted = formatAmount(balance.toString());
              if (options.all || balance > 0n) {
                const color = balance > 0n ? chalk.green : chalk.gray;
                console.log(`  ${network.name.padEnd(20)} ${color(formatted)} USDT`);
                hasNonZero = hasNonZero || balance > 0n;
              }
            }
          }

          if (!hasNonZero && !options.all) {
            console.log(chalk.gray("  No balances found. Use --all to show all networks."));
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
