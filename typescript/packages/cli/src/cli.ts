import { Command } from "commander";
import { registerWalletCommands } from "./commands/wallet.js";
import { registerPayCommands } from "./commands/pay.js";
import { registerRequestCommand } from "./commands/request.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerInfoCommand } from "./commands/info.js";

/**
 * Create and configure the CLI program
 */
export function createCli(): Command {
  const program = new Command();

  program
    .name("t402")
    .description("Command-line interface for the T402 payment protocol")
    .version("2.0.0");

  // Register command groups
  registerWalletCommands(program);
  registerPayCommands(program);
  registerRequestCommand(program);
  registerConfigCommands(program);
  registerInfoCommand(program);

  return program;
}

/**
 * Run the CLI
 */
export async function runCli(args: string[] = process.argv): Promise<void> {
  const program = createCli();
  await program.parseAsync(args);
}
