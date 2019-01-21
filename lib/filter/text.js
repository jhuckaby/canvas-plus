// canvas-plus - Image Transformation Engine
// Text Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");
var width_cache = {};

var measureWidthCache = function(ctx, text, kerning) {
	// only call measureText() for unique strings, bake in kerning too
	if (!kerning) kerning = 0;
	if (width_cache[text]) return width_cache[text];
	var info = ctx.measureText(text);
	width_cache[text] = info.width + (kerning * text.length);
	return width_cache[text];
};

module.exports = Class.create({
	
	text: function(opts) {
		// render text onto canvas
		// { text, font, size, color, gravity, overflow, marginX, marginY, offsetX, offsetY, characterSpacing, lineSpacing, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur, outlineColor, outlineThickness, outlineStyle, opacity, autoCrop, background, maxWidth, maxHeight, shrinkWrapPrecision, fontStyle, fontWeight, mode }
		var self = this;
		this.clearLastError();
		
		// must reset width cache for every call to text()
		width_cache = {};
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('text', "No options passed to text");
		}
		if (!opts.text) {
			return this.doError('text', "Missing text to render");
		}
		if (!opts.font) {
			return this.doError('text', "Missing font to render text");
		}
		if (!opts.size) {
			return this.doError('text', "Missing size to render text");
		}
		if (!opts.color) {
			return this.doError('text', "Missing color to render text");
		}
		if (!opts.text.match(/\S/)) {
			this.logDebug(3, "Text is all whitespace, skipping render");
			return this;
		}
		
		opts = this.copyHash( opts || {} );
		
		if ('margin' in opts) {
			opts.marginX = opts.marginY = opts.margin;
			delete opts.margin;
		}
		if ('characterSpacing' in opts) {
			opts.kerning = opts.characterSpacing;
			delete opts.characterSpacing;
		}
		// allow 'mode' to be passed in, but rename it to 'compositeMode'
		if (opts && opts.mode) {
			opts.compositeMode = opts.mode;
			delete opts.mode;
		}
		
		this.perf.begin('text');
		this.logDebug(6, "Rendering text", opts);
		
		// import settings into opts
		opts = this.applySettings(opts);
		
		if (!opts.font) {
			return this.doError('text', "No font specified");
		}
		
		var ctx = this.context;
		var width = this.get('width');
		var height = this.get('height');
		var font_family = this.getFontID( opts.font );
		var font_spec = opts.fontStyle + ' ' + opts.fontWeight + ' ' + opts.size + 'px "' + font_family + '"';
		
		ctx.save();
		ctx.font = font_spec;
		this.logDebug(9, "Canvas Font Spec: " + font_spec);
		
		ctx.textAlign = 'left';
		ctx.textBaseline = 'hanging';
		
		if (opts.shadowColor) {
			ctx.shadowColor = opts.shadowColor;
			ctx.shadowOffsetX = opts.shadowOffsetX || 0;
			ctx.shadowOffsetY = opts.shadowOffsetY || 0;
			ctx.shadowBlur = opts.shadowBlur || 0;
		}
		if (opts.outlineColor) {
			ctx.strokeStyle = opts.outlineColor;
			ctx.lineWidth = opts.outlineThickness * 2;
			ctx.lineJoin = opts.outlineStyle;
		}
		
		if (opts.opacity < 1) {
			ctx.globalAlpha = opts.opacity;
		}
		if (opts.compositeMode) {
			ctx.globalCompositeOperation = opts.compositeMode;
		}
		
		// measure one character for line height
		var info = ctx.measureText('M');
		if (!info.emHeightDescent && this.measureTextHeight) {
			// hack to measure height (browser-only)
			info.emHeightDescent = this.measureTextHeight(ctx.font);
		}
		if (!info.emHeightDescent) {
			ctx.restore();
			this.perf.end('text');
			return this.doError('text', "Could not measure font height");
		}
		var line_height = info.emHeightDescent + opts.lineSpacing;
		var kerning = opts.kerning;
		var overflow = opts.overflow || '';
		var lines = [];
		
		var dx = opts.offsetX || 0;
		var dy = opts.offsetY || 0;
		var mx = opts.marginX || 0;
		var my = opts.marginY || 0;
		var avail_width = opts.maxWidth || (width - (mx * 2));
		var avail_height = opts.maxHeight || (height - (my * 2));
		
		// sanity check here, avail_width and avail_height must both be > 0
		if ((avail_width < 1) || (avail_height < 1)) {
			ctx.restore();
			this.perf.end('text');
			return this.doError('text', "No available space to render text (check margins)");
		}
		
		// word wrap here
		if (overflow.match(/wrap/i)) {
			lines = this.wordWrapText(opts.text, avail_width, opts);
			if (lines === false) {
				ctx.restore();
				this.perf.end('text');
				return this.doError('text', "No available space to wrap text (check margins)");
			}
			
			if (overflow.match(/shrink/i)) {
				// re-wrap while shrinking to fit entire paragraph into image box
				var temp_avail_width = avail_width;
				var temp_avail_height = avail_height;
				var sw_precision = opts.shrinkWrapPrecision || 4;
				var attempts = 256;
				
				while (lines.length * line_height > temp_avail_height) {
					temp_avail_width += sw_precision;
					temp_avail_height += (sw_precision * (avail_height / avail_width));
					lines = this.wordWrapText(opts.text, temp_avail_width, opts);
					if (lines === false) {
						ctx.restore();
						this.perf.end('text');
						return this.doError('text', "No available space to shrink-wrap text (check margins)");
					}
					
					if (--attempts < 0) {
						// emergency brake, to prevent infinite loop
						ctx.restore();
						this.perf.end('text');
						return this.doError('text', "Insufficient available space to shrink-wrap text (check margins)");
					}
				}
			} // shrink-wrap
		}
		else {
			// standard flow (no wrap)
			lines = opts.text.trim().replace(/\r\n/g, "\n").split(/\n/);
		}
		
		// precalc line widths, adjust for kerning
		var line_widths = [];
		var longest_line_width = 0;
		for (var idx = 0, len = lines.length; idx < len; idx++) {
			var line = lines[idx];
			var line_width = measureWidthCache(ctx, line, kerning);
			line_widths[idx] = line_width;
			if (line_width > longest_line_width) longest_line_width = line_width;
		} // foreach line
		
		var text_width = longest_line_width;
		var text_height = lines.length * line_height;
		var gravity = opts.gravity;
		
		// define inline function for performing the actual rendering
		var renderText = function(ctx, width, height, mx, my, dx, dy) {
			var x = 0;
			var y = 0;
			
			if (gravity.match(/(north|top)/i)) y = 0 + my + dy;
			else if (gravity.match(/(south|bottom)/i)) y = ((height - my) - text_height) - dy;
			else y = ((height / 2) - (text_height / 2)) + dy;
			
			if (opts.background) {
				if (gravity.match(/(west|left)/i)) x = 0 + mx + dx;
				else if (gravity.match(/(east|right)/i)) x = ((width - mx) - text_width) - dx;
				else x = ((width / 2) - (text_width / 2)) + dx;
				
				ctx.fillStyle = opts.background;
				ctx.fillRect( x, y, text_width, text_height );
			}
			ctx.fillStyle = opts.color;
			
			// adjust for safari canvas line height issue (ughhhh)
			if (self.browser && self.userAgent.match(/Safari/) && !self.userAgent.match(/Chrome/)) {
				y -= ((line_height * 1.15) - line_height);
			}
			
			for (var idx = 0, len = lines.length; idx < len; idx++) {
				var line = lines[idx];
				var chars = line.split('');
				var line_width = line_widths[idx];
				
				if (gravity.match(/(west|left)/i)) x = 0 + mx + dx;
				else if (gravity.match(/(east|right)/i)) x = ((width - mx) - line_width) - dx;
				else x = ((width / 2) - (line_width / 2)) + dx;
				
				for (var idy = 0, ley = chars.length; idy < ley; idy++) {
					var ch = chars[idy];
					var ch_width = measureWidthCache(ctx, ch, kerning);
					
					if (ch.match(/\S/)) {
						if (opts.outlineColor) ctx.strokeText(ch, x, y);
						ctx.fillText(ch, x, y);
					}
					x += ch_width;
				} // foreach char
				
				y += line_height;
			} // foreach line
		}; // renderText()
		
		// see if we need to autoscale here
		var rendered = false;
		
		if (overflow.match(/shrink/i)) {
			var scale_factor_x = avail_width / text_width;
			var scale_factor_y = avail_height / text_height;
			var scale_factor = Math.min( scale_factor_x, scale_factor_y );
			
			this.logDebug(9, "Autoscale calculation", {
				avail_width: avail_width,
				avail_height: avail_height,
				text_width: text_width,
				text_height: text_height,
				scale_factor_x: scale_factor_x,
				scale_factor_y: scale_factor_y,
				scale_factor: scale_factor
			});
			
			if (scale_factor < 1.0) {
				// Scale using canvas math (only works accurately in browser, or with pango).
				// Now the standard method with node-canvas 2.0+
				ctx.scale( scale_factor, scale_factor );
				
				renderText(
					ctx, 
					width / scale_factor, 
					height / scale_factor, 
					mx / scale_factor, 
					my / scale_factor, 
					dx / scale_factor, 
					dy / scale_factor 
				);
				
				text_width = text_width * scale_factor;
				text_height = text_height * scale_factor;
				rendered = true;
			} // need shrink
		} // autoshrink
		
		// perform actual rendering
		if (!rendered) renderText( ctx, width, height, mx, my, dx, dy );
		
		ctx.restore();
		this.perf.end('text');
		
		// auto-crop to actual text size
		if (opts.autoCrop) {
			var cx = Math.floor( (width / 2) - (text_width / 2) );
			var cy = Math.floor( (height / 2) - (text_height / 2) );
			var acwidth = width;
			var acheight = height;
			
			if (opts.autoCrop.match(/horiz|both|all/i)) {
				acwidth = Math.floor( text_width + (mx * 2) );
			}
			if (opts.autoCrop.match(/vert|both|all/i)) {
				acheight = Math.floor( text_height + (my * 2) );
			}
			if (gravity.match(/(east|right)/i)) cx = width - acwidth;
			else if (gravity.match(/(south|bottom)/i)) cy = height - acheight;
			
			if ((acwidth < width) || (acheight < height)) {
				this.crop({
					width: acwidth,
					height: acheight,
					x: cx,
					y: cy
				});
			}
		} // auto-crop
		
		this.logDebug(6, "Text rendering complete");
		return this;
	},
	
	wordWrapText: function(text, avail_width, opts) {
		// word wrap text, leaning heavily on Context2D.measureText()
		var lines = text.trim().replace(/\r\n/g, "\n").split(/\n/);
		var ctx = this.context;
		var kerning = opts.kerning;
		
		// foreach line
		for (var idx = 0; idx < lines.length; idx++) {
			var line = lines[idx].replace(/\t/g, opts.tabSpaces || "    ").replace(/\s/g, ' ');
			var full_line_width = measureWidthCache(ctx, line, kerning);
			
			if (full_line_width > avail_width) {
				// line is too long, must break up words
				var words = line.split(/\s/);
				var prefix = '';
				var line_width = 0;
				var line_text = '';
				
				// foreach word
				for (idy = 0, ley = words.length; idy < ley; idy++) {
					var word = words[idy];
					if (word.length) {
						var full_word = prefix + word;
						var word_width = measureWidthCache(ctx, full_word, kerning);
						
						if (line_width + word_width > avail_width) {
							// word does not fit
							if (idy == 0) {
								// first word doesn't fit, we have to chop it up
								var temp_width = 0;
								var temp_text = '';
								
								// foreach character in word
								for (var idz = 0, lez = word.length; idz < lez; idz++) {
									var ch = word[idz];
									var ch_width = measureWidthCache(ctx, ch, kerning);
									if (temp_width + ch_width > avail_width) {
										// sanity check
										if (!idz) return false; // abort -- single character does not fit on line
										
										// chop at this point
										lines[idx] = temp_text;
										
										var append_text = word.substring(idz);
										if (idy < words.length - 1) append_text += ' ' + words.slice(idy + 1).join(' ');
										lines.splice( idx + 1, 0, append_text );
										
										// drop out of inner loop
										idz = lez;
									}
									else {
										// character fits, append and continue
										temp_width += ch_width;
										temp_text += ch;
									}
								} // foreach character
							} // first word on line
							else {
								// reset current line to contain only words up to this point
								lines[idx] = line_text;
								
								// shove remaining words onto next line (may extend array)
								lines.splice( idx + 1, 0, words.slice(idy).join(' ') );
							}
							
							// drop out of inner word loop
							idy = ley;
						} // word doesn't fit
						else {
							// word fits nicely, append and continue
							line_width += word_width;
							line_text += full_word;
							prefix = ' ';
						}
					} // word has length
					else {
						// extra space
						prefix += ' ';
					}
				} // foreach word
			} // line too wide
		} // foreach line
		
		return lines;
	}
	
});
