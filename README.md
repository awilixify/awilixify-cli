# awilixify-cli

Command-line tools and client code generation for [Awilixify](https://github.com/awilixify/awilixify) applications.

## Installation

```sh
npm install --save-dev awilixify-cli
```

## Code generation

Create an ESM configuration file which default-exports a codegen configuration:

```js
import { defineCodegenConfig } from "awilixify-cli/codegen";

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
