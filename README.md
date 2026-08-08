# @awilixify/cli

Command-line tools and client code generation for [Awilixify](https://github.com/awilixify/awilixify) applications.

## Installation

```sh
npm install --save-dev @awilixify/cli
```

## Code generation

Create an ESM configuration file which default-exports a codegen configuration:

```js
import { defineCodegenConfig } from "@awilixify/cli/codegen";

export default defineCodegenConfig({
	clients: [],
	asyncApiClients: [],
	asyncApiConsumers: [],
});
```

Then run:

```sh
npx awilixify codegen --config ./awilixify-codegen.config.mjs
```

The current generators support wrappers around Orval-generated OpenAPI clients and AsyncAPI publishers and consumers.

## DevTools AI skill

Install or update the Awilixify trace-debugging skill for Codex and Claude Code:

```sh
npx @awilixify/cli devtools init-ai
```

Use `--codex` or `--claude` to install for only one agent, `--root <path>` to
select another repository, and `--force` to replace a locally modified
installation. Without `--force`, locally changed skill files are preserved.

The command installs both `.agents/skills/awilixify-trace-debugging` for Codex
and `.claude/skills/awilixify-trace-debugging` for Claude Code.

Pass the concrete task as part of the skill invocation:

```text
$awilixify-trace-debugging Fix the issue described in tickets/order-failure.md
/awilixify-trace-debugging Fix the issue described in tickets/order-failure.md
```

The first form is for Codex and the second is for Claude Code. The task may
reference a ticket file or include the report, request, expected behavior, and
acceptance criteria directly. The skill discovers DevTools targets from
`DEVTOOLS_TARGETS`, `DevtoolsModule(...)`, Docker Compose, and referenced
environment configuration, then verifies candidates through the DevTools API.
