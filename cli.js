#!/usr/bin/env node

// Very simple CLI wrapper around canvas-plus
//
// Beware: This will REPLACE local images with the specified filters applied, unless "--output FILE" is specified.
// Or if you change format with `--filter "write/format:webp"` this will adjust the output filenames as well.
// Also, if you specify `--dir /path/to/dir` this will write the output files into the specified directory.
// Add `--verbose` to include full debug ouptut from canvas-plus.
//
// Usage: ./cli.js FILE1 [FILE2 ...] --filter "resize/width:400/height:300" --filter "adjust/hue:-60" --filter "write/quality:90"

var Path = require('path');
var fs = require('fs');
var cli = require('pixl-cli');
var CanvasPlus = require('./main.js');

cli.global();
var Tools = cli.Tools;
var async = Tools.async;

var args = cli.args;
var files = args.other;
var usage = `Usage: ./cli.js FILE1 [FILE2 ...] --filter "resize/width:400/height:300" --filter "adjust/hue:-60" --filter "write/quality:90"\n`;

if (!files || !files.length) die(usage);
if (!args.filter) die(usage);
if (args.output && (files.length > 1)) die("Error: Cannot use `--output` argument with multiple input files.  Consider `--dir` instead.\n");

var filters = [];
Tools.alwaysArray(args.filter).forEach( function(raw) {
	if (!raw.match(/^(\w+)\//)) die("Malformed filter: " + raw + "\n");
	var name = RegExp.$1;
	var params = {};
	raw = raw.replace(/^(\w+)\//, '');
	
	raw.split(/\//).forEach( function(arg) {
		if (!arg.match(/^(.+)\:(.+)$/)) die("Malformed filter: " + raw + "\n");
		var key = RegExp.$1;
		var value = RegExp.$2;
		
		if (value.match(/^\-?\d+\.\d+$/)) value = parseFloat(value);
		else if (value.match(/^\-?\d+$/)) value = parseInt(value);
		else if (value.match(/^true$/)) value = true;
		else if (value.match(/^false$/)) value = false;
		
		if (key.match(/^(clip|rect|line|rgb|red|green|blue|alpha|matrix)$/)) {
			// parse CSV into arrays for specific param names
			value = value.split(/\,/).map( function(num) { return parseFloat(num); } );
		}
		if ((key == 'clip') && Array.isArray(value)) {
			// clip has a special syntax {x/y/width/height}
			value = { x: value[0], y: value[1], width: value[2], height: value[3] };
		}
		
		params[ key ] = value;
	});
	
	params._name = name;
	filters.push( params );
} );

async.eachSeries( files,
	function(file, callback) {
		var canvas = new CanvasPlus();
		if (args.debug || args.verbose) canvas.set('debug', true);
		
		var obj = {};
		for (var key in args) {
			if (key.match(/^params\.(.+)$/)) Tools.setPath(obj, RegExp.$1, args[key]);
		}
		canvas.set(obj);
		
		canvas.load( file, function(err) {
			if (err) return callback(err);
			var write_opts = {};
			
			async.eachSeries( filters,
				function(filter, callback) {
					var name = filter._name;
					var params = Tools.copyHashRemoveKeys(filter, { _name: 1 });
					
					if (name == 'write') write_opts = params;
					else if (name == 'composite') return handleComposite(canvas, params, callback);
					else if (name == 'mask') {
						params.mode = 'destination-in';
						return handleComposite(canvas, params, callback);
					}
					else canvas[name](params);
					
					if (canvas.getLastError()) {
						die("Failed to process image: " + file + ": " + name + ":" + canvas.getLastError() + "\n");
					}
					
					process.nextTick(callback);
				},
				function(err) {
					if (err) die("Error: " + err + "\n");
					
					// write
					canvas.write( write_opts, function(err, buf) {
						if (err) return callback(err);
						
						// if changing format, also change file ext
						if (write_opts.format) file = file.replace(/\.\w+$/, '.' + write_opts.format.replace(/jpeg/, 'jpg'));
						
						// if dir specified, change file path
						if (args.dir) file = Path.join( args.dir, Path.basename(file) );
						
						// insert optional appendage before file ext
						if (args.append) file = file.replace(/(\.\w+)$/, args.append + '$1');
						
						fs.writeFile( args.output || file, buf, function(err) {
							if (err) return callback(err);
							
							print("Wrote: " + (args.output || file) + "\n");
							canvas.logDebug(3, "Performance Metrics: ", canvas.getMetrics() );
							callback();
						});
					} ); // write
				}
			); // eachSeries
		}); // load
	},
	function(err) {
		if (err) die("Error: " + err + "\n");
		print("Done!\n");
	}
); // eachSeries

function handleComposite(canvas, params, callback) {
	// handle composite (must load image from disk)
	var img = new CanvasPlus();
	img.load( params.image, function(err) {
		if (err) return callback(err);
		params.image = img;
		canvas.composite(params);
		callback( canvas.getLastError() );
	} );
};
