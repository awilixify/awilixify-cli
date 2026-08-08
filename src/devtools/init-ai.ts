import { createHash } from "node:crypto";
import {
	cp,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "awilixify-trace-debugging";
const MARKER_FILE = ".awilixify-skill-install.json";
const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
);
const SOURCE_SKILL = path.join(PACKAGE_ROOT, "skills", SKILL_NAME);
const AGENT_DESTINATIONS = {
	claude: path.join(".claude", "skills", SKILL_NAME),
	codex: path.join(".agents", "skills", SKILL_NAME),
} as const;

type Agent = keyof typeof AGENT_DESTINATIONS;

interface InstallAiOptions {
	agents?: Agent[];
	force?: boolean;
	root?: string;
}

interface InstallMarker {
	contentHash: string;
	skill: string;
	sourcePackage: string;
	sourceVersion: string;
}

interface InstallResult {
	agent: Agent;
	destination: string;
	reason?: string;
	status: "installed" | "skipped" | "updated" | "up-to-date";
}

interface InstallForAgentOptions {
	agent: Agent;
	destination: string;
	force: boolean;
	packageVersion: string;
	sourceHash: string;
}

export async function installAi(options: InstallAiOptions = {}): Promise<{
	projectRoot: string;
	results: InstallResult[];
}> {
	const projectRoot = path.resolve(
		options.root ?? (await findProjectRoot(process.cwd())),
	);
	const agents: Agent[] = options.agents?.length
		? options.agents
		: ["codex", "claude"];
	const packageJson = JSON.parse(
		await readFile(path.join(PACKAGE_ROOT, "package.json"), "utf8"),
	) as { version?: unknown };
	if (typeof packageJson.version !== "string") {
		throw new Error("CLI package version is missing");
	}
	const sourceHash = await hashDirectory(SOURCE_SKILL);
	const results: InstallResult[] = [];

	for (const agent of agents) {
		const destination = path.join(projectRoot, AGENT_DESTINATIONS[agent]);
		results.push(
			await installForAgent({
				agent,
				destination,
				force: options.force ?? false,
				packageVersion: packageJson.version,
				sourceHash,
			}),
		);
	}

	return { projectRoot, results };
}

async function installForAgent(
	options: InstallForAgentOptions,
): Promise<InstallResult> {
	const existing = await getExistingInstall(options.destination);
	if (existing.exists && !options.force) {
		if (!existing.marker) {
			return skipped(
				options,
				"destination exists but was not installed by this command",
			);
		}
		const currentHash = await hashDirectory(options.destination);
		if (currentHash !== existing.marker.contentHash) {
			return skipped(
				options,
				"installed skill has local changes; use --force to replace it",
			);
		}
		if (currentHash === options.sourceHash) {
			return {
				agent: options.agent,
				destination: options.destination,
				status: "up-to-date",
			};
		}
	}

	const destinationParent = path.dirname(options.destination);
	await mkdir(destinationParent, { recursive: true });
	const temporaryRoot = await mkdtemp(
		path.join(destinationParent, ".awilixify-skill-"),
	);
	const temporarySkill = path.join(temporaryRoot, SKILL_NAME);

	try {
		await cp(SOURCE_SKILL, temporarySkill, { recursive: true });
		await writeFile(
			path.join(temporarySkill, MARKER_FILE),
			`${JSON.stringify(
				{
					contentHash: options.sourceHash,
					skill: SKILL_NAME,
					sourcePackage: "@awilixify/cli",
					sourceVersion: options.packageVersion,
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
		if (await exists(options.destination)) {
			await rm(options.destination, { recursive: true });
		}
		await rename(temporarySkill, options.destination);
	} finally {
		await rm(temporaryRoot, { force: true, recursive: true });
	}

	return {
		agent: options.agent,
		destination: options.destination,
		status: existing.exists ? "updated" : "installed",
	};
}

function skipped(
	options: InstallForAgentOptions,
	reason: string,
): InstallResult {
	return {
		agent: options.agent,
		destination: options.destination,
		reason,
		status: "skipped",
	};
}

async function getExistingInstall(destination: string): Promise<{
	exists: boolean;
	marker: InstallMarker | null;
}> {
	if (!(await exists(destination))) return { exists: false, marker: null };
	if ((await listFiles(destination)).length === 0) {
		return { exists: false, marker: null };
	}
	try {
		const marker = JSON.parse(
			await readFile(path.join(destination, MARKER_FILE), "utf8"),
		) as InstallMarker;
		return { exists: true, marker };
	} catch {
		return { exists: true, marker: null };
	}
}

async function hashDirectory(directory: string): Promise<string> {
	const hash = createHash("sha256");
	for (const file of await listFiles(directory)) {
		if (file === MARKER_FILE) continue;
		hash.update(file);
		hash.update("\0");
		hash.update(await readFile(path.join(directory, file)));
		hash.update("\0");
	}
	return hash.digest("hex");
}

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(path.join(directory, prefix), {
		withFileTypes: true,
	})) {
		const relativePath = path.join(prefix, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(directory, relativePath)));
		} else if (entry.isFile()) files.push(relativePath);
	}
	return files.sort();
}

async function findProjectRoot(start: string): Promise<string> {
	let current = path.resolve(start);
	while (true) {
		if (await exists(path.join(current, ".git"))) return current;
		const parent = path.dirname(current);
		if (parent === current) return path.resolve(start);
		current = parent;
	}
}

async function exists(target: string): Promise<boolean> {
	try {
		await stat(target);
		return true;
	} catch (error: unknown) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return false;
		}
		throw error;
	}
}

function parseArguments(argv: string[]): InstallAiOptions & { help?: boolean } {
	const options: InstallAiOptions & { help?: boolean } = { agents: [] };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--all") options.agents = ["codex", "claude"];
		else if (argument === "--codex") options.agents?.push("codex");
		else if (argument === "--claude") options.agents?.push("claude");
		else if (argument === "--force") options.force = true;
		else if (argument === "--root") {
			options.root = requireValue(argv, ++index, argument);
		} else if (argument === "--help" || argument === "-h") options.help = true;
		else throw new Error(`Unknown argument ${argument}`);
	}

	options.agents = [...new Set(options.agents)];
	return options;
}

function requireValue(values: string[], index: number, flag: string): string {
	const value = values[index];
	if (!value) throw new Error(`${flag} requires a value`);
	return value;
}

function printHelp(): void {
	console.log(`Usage: awilixify devtools init-ai [--all | --codex | --claude] [--root <path>] [--force]

Installs the Awilixify trace-debugging skill for Codex and Claude by default.
Existing locally modified installations are preserved unless --force is used.`);
}

export async function runInitAi(argv: string[]): Promise<void> {
	const options = parseArguments(argv);
	if (options.help) {
		printHelp();
		return;
	}
	const result = await installAi(options);
	console.log(`Project: ${result.projectRoot}`);
	for (const item of result.results) {
		console.log(
			`${item.agent}: ${item.status} ${item.destination}${item.reason ? ` (${item.reason})` : ""}`,
		);
	}
	console.log("Codex: $awilixify-trace-debugging <issue or task>");
	console.log("Claude: /awilixify-trace-debugging <issue or task>");
}
