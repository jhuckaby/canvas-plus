// canvas-plus - Image Transformation Engine
// Draw Filter Mixin
// Copyright (c) 2020 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	draw: function(opts) {
		// run arbitrary draw commands on canvas
		// special opts: params, commands
		// convenience opts: line, rect, fill, stroke
		var self = this;
		var result;
		this.clearLastError();
		
		result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('opts', "Must specify options object");
		}
		opts = this.copyHash( opts || {} );
		
		// allow for shortcut convenience methods
		if (opts.line) {
			if (!opts.commands) opts.commands = [];
			opts.commands.push(
				['beginPath'],
				['moveTo'].concat( opts.line.slice(0, 2) ),
				['lineTo'].concat( opts.line.slice(2) )
			);
			delete opts.line;
		}
		if (opts.rect) {
			if (!opts.commands) opts.commands = [];
			opts.commands.push( ['rect'].concat( opts.rect ) );
			delete opts.rect;
		}
		if (opts.fill) {
			if (!opts.params) opts.params = {};
			opts.params.fillStyle = opts.fill;
			
			if (!opts.commands) opts.commands = [];
			opts.commands.push( ['fill'] );
			
			delete opts.fill;
		}
		if (opts.stroke) {
			if (!opts.params) opts.params = {};
			opts.params.strokeStyle = opts.stroke;
			
			if (!opts.commands) opts.commands = [];
			opts.commands.push( ['stroke'] );
			
			delete opts.stroke;
		}
		
		// we need at least one command to continue
		if (!opts.commands) {
			return this.doError('opts', "Must specify commands array inside options object");
		}
		
		this.perf.begin('draw');
		this.logDebug(5, "Rendering custom draw commands on canvas", opts);
		
		// prep
		var ctx = this.context;
		ctx.save();
		
		// optionally specify properties to set on context
		// (e.g. fillStyle, strokeStyle, lineWidth, globalCompositeOperation)
		if (opts.params) {
			for (var key in opts.params) { ctx[key] = opts.params[key]; }
		}
		
		// apply antialias if specified
		if (opts.antialias) {
			this.applyAntialias( opts.antialias );
		}
		
		// apply all commands
		// e.g. [ ['rect', 50, 50, 100, 100], ['fill'] ]
		opts.commands.forEach( function(args) {
			var name = args.shift();
			self.logDebug(9, "Executing Command: " + name, args);
			ctx[name].apply( ctx, args );
		});
		
		ctx.restore();
		this.perf.end('draw');
		this.logDebug(6, "Draw complete");
		return this;
	}
	
});
