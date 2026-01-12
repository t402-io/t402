import { Command } from "commander";
import chalk from "chalk";
import {
  getConfig,
  setConfig,
  getAllConfig,
  resetConfig,
  getConfigPath,
  setRpcEndpoint,
  getRpcEndpoint,
} from "../config/index.js";
import {
  printSuccess,
  printError,
  printWarning,
  printHeader,
  printTable,
  getNetworkName,
  isValidUrl,
} from "../utils/index.js";
import type { CliConfig } from "../types.js";

/**
 * Register configuration commands
 */
export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Configuration management");

  // config show
  config
    .command("show")
    .description("Show current configuration")
    .action(() => {
      const cfg = getAllConfig();

      printHeader("T402 CLI Configuration");

      const displayConfig: Record<string, string> = {
        "Default Network": getNetworkName(cfg.defaultNetwork),
        "Network ID": cfg.defaultNetwork,
        "Facilitator URL": cfg.facilitatorUrl,
        "Testnet Mode": cfg.testnet ? chalk.yellow("Yes") : "No",
        "Wallet Configured": cfg.encryptedSeed ? chalk.green("Yes") : chalk.gray("No"),
        "Config File": getConfigPath(),
      };

      printTable(displayConfig);

      // Show custom RPC endpoints if any
      const endpoints = cfg.rpcEndpoints;
      if (Object.keys(endpoints).length > 0) {
        console.log();
        console.log(chalk.bold("Custom RPC Endpoints:"));
        for (const [network, url] of Object.entries(endpoints)) {
          console.log(`  ${getNetworkName(network)}: ${url}`);
        }
      }
    });

  // config get
  config
    .command("get")
    .description("Get a configuration value")
    .argument("<key>", "Configuration key (defaultNetwork, facilitatorUrl, testnet)")
    .action((key: string) => {
      const validKeys = ["defaultNetwork", "facilitatorUrl", "testnet", "rpcEndpoints"];
      if (!validKeys.includes(key)) {
        printError(`Invalid key. Valid keys: ${validKeys.join(", ")}`);
        return;
      }

      const value = getConfig(key as keyof CliConfig);
      if (typeof value === "object") {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }
    });

  // config set
  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Configuration key")
    .argument("<value>", "Value to set")
    .action((key: string, value: string) => {
      switch (key) {
        case "defaultNetwork":
          setConfig("defaultNetwork", value);
          printSuccess(`Default network set to ${getNetworkName(value)}`);
          break;

        case "facilitatorUrl":
          if (!isValidUrl(value)) {
            printError("Invalid URL format");
            return;
          }
          setConfig("facilitatorUrl", value);
          printSuccess(`Facilitator URL set to ${value}`);
          break;

        case "testnet":
          const isTestnet = value.toLowerCase() === "true" || value === "1";
          setConfig("testnet", isTestnet);
          printSuccess(`Testnet mode ${isTestnet ? "enabled" : "disabled"}`);

          // Suggest appropriate default network
          if (isTestnet) {
            setConfig("defaultNetwork", "eip155:84532");
            console.log(chalk.gray("  Default network changed to Base Sepolia"));
          } else {
            setConfig("defaultNetwork", "eip155:8453");
            console.log(chalk.gray("  Default network changed to Base"));
          }
          break;

        default:
          printError(
            `Unknown key: ${key}. Valid keys: defaultNetwork, facilitatorUrl, testnet`,
          );
      }
    });

  // config rpc
  config
    .command("rpc")
    .description("Set custom RPC endpoint for a network")
    .argument("<network>", "Network ID (e.g., eip155:8453)")
    .argument("<url>", "RPC endpoint URL")
    .action((network: string, url: string) => {
      if (!isValidUrl(url)) {
        printError("Invalid URL format");
        return;
      }

      setRpcEndpoint(network, url);
      printSuccess(`RPC endpoint set for ${getNetworkName(network)}`);
    });

  // config reset
  config
    .command("reset")
    .description("Reset configuration to defaults")
    .option("-f, --force", "Skip confirmation")
    .action((options: { force?: boolean }) => {
      if (!options.force) {
        printWarning("This will reset all configuration to defaults.");
        printWarning("Your wallet will NOT be removed.");
        console.log();
        console.log("Run with --force to confirm.");
        return;
      }

      // Preserve wallet
      const cfg = getAllConfig();
      const encryptedSeed = cfg.encryptedSeed;

      resetConfig();

      // Restore wallet if it existed
      if (encryptedSeed) {
        setConfig("encryptedSeed", encryptedSeed);
      }

      printSuccess("Configuration reset to defaults");
    });

  // config path
  config
    .command("path")
    .description("Show configuration file path")
    .action(() => {
      console.log(getConfigPath());
    });
}
