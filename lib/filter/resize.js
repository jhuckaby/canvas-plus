// canvas-plus - Image Transformation Engine
// Resize Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	resize: function(opts) {
		// resize image
		// { width, height, mode, background, direction, antialias, gravity, offsetX, offsetY, delta }
		var self = this;
		var result;
		this.clearLastError();
		
		// convert back to RGBA if indexed
		if (this.get('mode') == 'indexed') {
			result = this.render();
			if (result.isError) return result;
		}
		
		// if image requires EXIF orientation correction, must do that first
		if (this.get('autoOrient') && this.image && !this.canvas && this.exif && this.exif.Orientation && (this.exif.Orientation > 1)) {
			result = this.render();
			if (result.isError) return result;
		} // auto-orient
		
		if (!this.canvas && !this.image) {
			return this.doError('resize', "No image to resize");
		}
		if (!opts || (!opts.width && !opts.height)) {
			return this.doError('resize', "Both width and height were not specified");
		}
		
		opts = this.copyHash( opts || {} );
		
		this.perf.begin('resize');
		
		// allow 'mode' to be passed in, but rename it to 'resizeMode'
		if (opts && opts.mode) {
			opts.resizeMode = opts.mode;
			delete opts.mode;
		}
		
		// allow 'direction' to be passed in, but rename it to 'resizeDirection'
		if (opts && opts.direction) {
			opts.resizeDirection = opts.direction;
			delete opts.direction;
		}
		
		var orig_width = this.get('width');
		var orig_height = this.get('height');
		
		// if width or height are missing, set to 0 so they aren't overwritten in applySettings
		if (!opts.width) opts.width = 0;
		if (!opts.height) opts.height = 0;
		
		// allow width and/or height to be percentage strings
		if ((typeof(opts.width) == 'string') && opts.width.match(/([\d\.]+)\%/)) {
			var pct = parseFloat( RegExp.$1 );
			opts.width = Math.floor( orig_width * (pct / 100) );
		}
		if ((typeof(opts.height) == 'string') && opts.height.match(/([\d\.]+)\%/)) {
			var pct = parseFloat( RegExp.$1 );
			opts.height = Math.floor( orig_height * (pct / 100) );
		}
		
		// import settings into opts
		opts = this.applySettings(opts);
		
		// support delta
		if (opts.delta) {
			opts.width = (opts.width || 0) + orig_width;
			opts.height = (opts.height || 0) + orig_height;
		}
		
		// extrapolate width or height if missing, maintaining aspect ratio
		var target_width = opts.width || Math.floor( orig_width * (target_height / orig_height) );
		var target_height = opts.height || Math.floor( orig_height * (target_width / orig_width) );
		
		target_width = Math.max(1, Math.floor(target_width));
		target_height = Math.max(1, Math.floor(target_height));
		
		// calculate final destination width/height preserving aspect ratio
		var ratios = [ target_width / orig_width, target_height / orig_height ];
		var mode = opts.resizeMode;
		var rfunc = mode.match(/(fitover|cover)/i) ? Math.max : Math.min;
		var ratio = rfunc.apply( Math, ratios );
		
		var dir = opts.resizeDirection;
		if (dir.match(/shrink/i)) ratio = Math.min( 1.0, ratio );
		else if (dir.match(/enlarge/i)) ratio = Math.max( 1.0, ratio );
		
		var dest_width = Math.max(1, Math.floor( orig_width * ratio ));
		var dest_height = Math.max(1, Math.floor( orig_height * ratio ));
		
		// special scale mode = ignore aspect ratio (distort)
		// direction is ignored in this mode
		if (mode.match(/(scale|exact)/i)) {
			dest_width = target_width;
			dest_height = target_height;
		}
		
		// calculate new canvas size
		var canvas_width = opts.width = mode.match(/(fitpad|letterbox|fitover|cover)/i) ? target_width : dest_width;
		var canvas_height = opts.height = mode.match(/(fitpad|letterbox|fitover|cover)/i) ? target_height : dest_height;
		
		// calculate image draw position based on gravity
		var dx = opts.offsetX || 0;
		var dy = opts.offsetY || 0;
		var gravity = opts.gravity;
		var x = 0;
		var y = 0;
		
		if (gravity.match(/(west|left)/i)) x = 0 + dx;
		else if (gravity.match(/(east|right)/i)) x = (canvas_width - dest_width) - dx;
		else x = Math.floor( (canvas_width / 2) - (dest_width / 2) ) + dx;
		
		if (gravity.match(/(north|top)/i)) y = 0 + dy;
		else if (gravity.match(/(south|bottom)/i)) y = (canvas_height - dest_height) - dy;
		else y = Math.floor( (canvas_height / 2) - (dest_height / 2) ) + dy;
		
		this.logDebug(6, "Resizing image to target size: " + target_width + 'x' + target_height, {
			mode: mode,
			gravity: gravity,
			background: opts.background,
			orig_width: orig_width,
			orig_height: orig_height,
			target_width: target_width,
			target_height: target_height,
			dest_width: dest_width,
			dest_height: dest_height,
			canvas_width: canvas_width,
			canvas_height: canvas_height,
			x: x,
			y: y
		});
		
		// source can be image or canvas
		var source_image = this.image || this.canvas;
		delete this.image;
		
		// create new canvas to resize onto
		result = this.create({ width: opts.width, height: opts.height, background: opts.background });
		if (result.isError) {
			this.perf.end('resize');
			return result;
		}
		
		// save state, so resize can temporarily alter things like patternQuality
		this.context.save();
		
		// copy over all canvas props
		for (var key in this.canvasSettingsKeys) {
			this.context[key] = opts[key];
		}
		
		if (opts.opacity < 1) {
			this.context.globalAlpha = opts.opacity;
		}
		if (opts.compositeMode) {
			this.context.globalCompositeOperation = opts.compositeMode;
		}
		
		// apply antialias if specified
		if (opts.antialias) {
			this.applyAntialias( opts.antialias );
		}
		
		// perform the actual draw
		this.context.drawImage(source_image, x, y, dest_width, dest_height);
		
		// restore original state
		this.context.restore();
		
		this.perf.end('resize');
		this.logDebug(6, "Image resize complete");
		return this;
	}
	
});
