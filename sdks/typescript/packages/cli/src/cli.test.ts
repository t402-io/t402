import { describe, it, expect } from "vitest";
import { createCli } from "./cli.js";

describe("createCli", () => {
  it("creates a commander program", () => {
    const cli = createCli();
    expect(cli.name()).toBe("t402");
  });

  it("has wallet command", () => {
    const cli = createCli();
    const walletCommand = cli.commands.find((c) => c.name() === "wallet");
    expect(walletCommand).toBeDefined();
  });

  it("has pay command", () => {
    const cli = createCli();
    const payCommand = cli.commands.find((c) => c.name() === "pay");
    expect(payCommand).toBeDefined();
  });

  it("has request command", () => {
    const cli = createCli();
    const requestCommand = cli.commands.find((c) => c.name() === "request");
    expect(requestCommand).toBeDefined();
  });

  it("has config command", () => {
    const cli = createCli();
    const configCommand = cli.commands.find((c) => c.name() === "config");
    expect(configCommand).toBeDefined();
  });

  it("has info command", () => {
    const cli = createCli();
    const infoCommand = cli.commands.find((c) => c.name() === "info");
    expect(infoCommand).toBeDefined();
  });

  it("has wallet subcommands", () => {
    const cli = createCli();
    const walletCommand = cli.commands.find((c) => c.name() === "wallet");
    const subcommands = walletCommand?.commands.map((c) => c.name()) || [];

    expect(subcommands).toContain("create");
    expect(subcommands).toContain("import");
    expect(subcommands).toContain("show");
    expect(subcommands).toContain("balance");
    expect(subcommands).toContain("clear");
    expect(subcommands).toContain("export");
  });

  it("has config subcommands", () => {
    const cli = createCli();
    const configCommand = cli.commands.find((c) => c.name() === "config");
    const subcommands = configCommand?.commands.map((c) => c.name()) || [];

    expect(subcommands).toContain("show");
    expect(subcommands).toContain("get");
    expect(subcommands).toContain("set");
    expect(subcommands).toContain("rpc");
    expect(subcommands).toContain("reset");
    expect(subcommands).toContain("path");
  });
});
