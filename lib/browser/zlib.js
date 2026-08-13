// canvas-plus - Image Transformation Engine
// Browser Zlib Shim
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

// Canvas Plus only needs one small part of Node's zlib API in the browser:
// synchronous DEFLATE compression for indexed PNG pixel data.  Using pako
// directly avoids bundling the much larger stream-based browserify-zlib shim.

var Buffer = require('buffer').Buffer;
var pako = require('pako');

// Z_RLE is part of zlib's stable public API and has the numeric value 3.
// Pako accepts the same strategy values, but version 3 no longer exports the
// constants object that earlier releases exposed.
var Z_RLE = 3;

module.exports = {
	// Match the modern Node.js zlib constants object used by lib/format/png.js.
	constants: { Z_RLE: Z_RLE },
	Z_RLE: Z_RLE,
	
	deflateSync: function(data, options) {
		// pako returns a Uint8Array, while the PNG writer expects a Node-style
		// Buffer with methods such as copy().  The browser Buffer shim provides
		// that API without affecting the Node.js implementation.
		return Buffer.from( pako.deflate(data, options) );
	}
};
