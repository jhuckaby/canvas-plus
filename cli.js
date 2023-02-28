#!/usr/bin/env node

// Very simple CLI wrapper around canvas-plus
// Beware: This will REPLACE local images with the specified filters applied, unless "--output FILE" is specified.
// Usage: ./cli.js FILE1 [FILE2 ...] --filter "resize/width:400/height:300" --filter "adjust/hue:-60" --filter "write/quality:90"

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
			
			filters.forEach( function(filter) {
				var name = filter._name;
				var params = Tools.copyHashRemoveKeys(filter, { _name: 1 });
				
				if (name == 'write') write_opts = params;
				else canvas[name](params);
				
				if (canvas.getLastError()) {
					die("Failed to process image: " + file + ": " + name + ":" + err + "\n");
				}
			}); // forEach filter
			
			// write
			canvas.write( write_opts, function(err, buf) {
				if (err) return callback(err);
				
				fs.writeFile( args.output || file, buf, function(err) {
					if (err) return callback(err);
					
					print("Wrote: " + (args.output || file) + "\n");
					canvas.logDebug(3, "Performance Metrics: ", canvas.getMetrics() );
					callback();
				});
			} );
		}); // load
	},
	function(err) {
		if (err) die("Error: " + err + "\n");
		print("Done!\n");
	}
); // eachSeries
