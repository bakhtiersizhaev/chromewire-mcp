#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { makeServer } from './server.js';

const server = makeServer();
const transport = new StdioServerTransport();

await server.connect(transport);
