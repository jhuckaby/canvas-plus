// canvas-plus - Image Transformation Engine
// Browser Build Global Shims
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

// This file is consumed by esbuild's "inject" option.  The ESM exports are
// required by esbuild, but they do not change Canvas Plus itself to ESM.  The
// library source and its public Node.js interface remain entirely CommonJS.

import processShim from 'process/browser';
import { Buffer as BufferShim } from 'buffer';

// Export names matching the Node.js globals used by Canvas Plus and its
// dependencies.  esbuild injects these only into modules that reference them,
// which avoids adding process, Buffer or global to the browser window object.
var process = processShim;
var Buffer = BufferShim;
var global = (typeof globalThis !== 'undefined') ? globalThis : window;

export { process, Buffer, global };
