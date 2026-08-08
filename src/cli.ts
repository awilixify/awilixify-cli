#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AwilixifyCodegenConfig } from "./codegen/config.js";
import {
	generateAsyncApiClient,
	generateAsyncApiConsumer,
} from "./codegen/generate-asyncapi-client.js";
import { generateOrvalApiClient } from "./codegen/generate-orval-api-client.js";
import { runInitAi } from "./devtools/init-ai.js";

function printHelp(): void {
	console.log(`Usage: awilixify <command>

Commands:
  codegen --config <path>  Generate clients from an Awilixify codegen config
  devtools init-ai         Install the Awilixify trace-debugging AI skill`);
}

async function runCodegen(args: string[]): Promise<void> {
	if (args.includes("--help") || args.includes("-h")) {
		console.log(
			"Usage: awilixify codegen --config <path-to-codegen-config.mjs>",
		);
		return;
	}

	const configArgumentIndex = args.indexOf("--config");
	const configPath = args[configArgumentIndex + 1];

	if (configArgumentIndex === -1 || !configPath) {
		throw new Error("The codegen command requires --config");
	}

	const resolvedConfigPath = resolve(configPath);
	const configDirectory = dirname(resolvedConfigPath);
	const configModule = (await import(
		pathToFileURL(resolvedConfigPath).href
	)) as {
		default?: AwilixifyCodegenConfig;
	};
	const config = configModule.default;

	if (!config) {
		throw new Error(
			"Codegen config must default-export a configuration object",
		);
	}

	for (const client of config.clients ?? []) {
		await generateOrvalApiClient({
			...client,
			outputDirectory: resolve(configDirectory, client.outputDirectory),
			module: client.module
				? {
						...client.module,
						outputPath: resolve(configDirectory, client.module.outputPath),
					}
				: undefined,
		});
	}

	for (const client of config.asyncApiClients ?? []) {
		await generateAsyncApiClient({
			...client,
			outputDirectory: resolve(configDirectory, client.outputDirectory),
			module: client.module
				? {
						...client.module,
						outputPath: resolve(configDirectory, client.module.outputPath),
					}
				: undefined,
		});
	}

	for (const consumer of config.asyncApiConsumers ?? []) {
		await generateAsyncApiConsumer({
			...consumer,
			outputDirectory: resolve(configDirectory, consumer.outputDirectory),
			module: consumer.module
				? {
						...consumer.module,
						outputPath: resolve(configDirectory, consumer.module.outputPath),
					}
				: undefined,
		});
	}
}

async function runDevtools(args: string[]): Promise<void> {
	const [command, ...commandArgs] = args;
	if (command === "--help" || command === "-h") {
		console.log("Usage: awilixify devtools init-ai [options]");
		return;
	}
	if (command !== "init-ai") {
		throw new Error("Usage: awilixify devtools init-ai [options]");
	}
	await runInitAi(commandArgs);
}

async function main(): Promise<void> {
	const [, , command, ...args] = process.argv;
	if (!command || command === "--help" || command === "-h") {
		printHelp();
		return;
	}

	if (command === "codegen") await runCodegen(args);
	else if (command === "devtools") await runDevtools(args);
	else throw new Error(`Unknown command ${command}`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
