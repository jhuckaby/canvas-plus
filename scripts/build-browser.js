// canvas-plus - Image Transformation Engine
// Browser Bundle Build Script
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Path = require('path');
var esbuild = require('esbuild');

var rootDir = Path.resolve( __dirname, '..' );

// esbuild intentionally does not provide Node.js core modules in browser
// builds.  Map only the small subset used by Canvas Plus and pixl-class.  This
// keeps the dependency tree and generated bundle much smaller than a complete
// Node.js standard-library polyfill package.
var aliases = {
	'zlib': Path.join( rootDir, 'lib/browser/zlib.js' ),
	'util': require.resolve('util/'),
	'events': require.resolve('events/')
};

var nodeShimPlugin = {
	name: 'canvas-plus-node-shims',
	setup: function(build) {
		// Redirect the Node.js modules that have real browser implementations.
		build.onResolve({ filter: /^(zlib|util|events)$/ }, function(args) {
			return { path: aliases[args.path] };
		});
		
		// ExifReader contains optional Node.js URL and filesystem loaders.  Canvas
		// Plus always gives it an in-memory image buffer in browser builds, so
		// those branches are unreachable and can safely resolve to empty modules.
		build.onResolve({ filter: /^(fs|http|https)$/ }, function(args) {
			return { path: args.path, namespace: 'empty-node-module' };
		});
		
		build.onLoad({ filter: /.*/, namespace: 'empty-node-module' }, function() {
			return { contents: 'module.exports = {};', loader: 'js' };
		});
	}
};

esbuild.build({
	entryPoints: [ Path.join(rootDir, 'browser.js') ],
	outfile: Path.join( rootDir, 'canvas-plus.js' ),
	bundle: true,
	platform: 'browser',
	format: 'iife',
	target: 'es2018',
	inject: [ Path.join(rootDir, 'lib/browser/esbuild-shims.js') ],
	plugins: [ nodeShimPlugin ],
	logLevel: 'info'
}).catch( function(err) {
	console.error(err);
	process.exit(1);
});
