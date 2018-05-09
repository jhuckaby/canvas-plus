// canvas-plus - Image Transformation Engine
// Transform Filter Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	transform: function(opts) {
		// transform image using geometry
		// { rotate, fliph, flipv, matrix, antialias }
		var self = this;
		this.clearLastError();
		
		var result = this.requireRGBA();
		if (result.isError) return result;
		
		if (!opts) {
			return this.doError('render', "No options passed to transform");
		}
		
		opts = this.copyHash( opts || {} );
		
		this.perf.begin('transform');
		this.logDebug(6, "Transforming image", opts);
		
		var ctx = this.context;
		var width = this.get('width');
		var height = this.get('height');
		
		// clone and clear
		var clone = this.clone();
		
		if (opts.rotate) {
			if (opts.rotate < 0) opts.rotate += 360;
			opts.rotate = opts.rotate % 360;
		}
		
		if (opts.rotate && !opts.fixed) {
			if ((opts.rotate == 90) || (opts.rotate == 180) || (opts.rotate == 270)) {
				// image is 90, 180 or 270 degrees, need to swap width/height
				if ((opts.rotate == 90) || (opts.rotate == 270)) {
					this.logDebug(5, "Swapping width/height for rotate " + opts.rotate);
					var temp = this.get('width');
					this.set('width', this.get('height'));
					this.set('height', temp);
				}
				
				// recreate canvas at new size
				this.create(opts);
				ctx = this.context;
				ctx.save();
				
				switch (opts.rotate) {
					case 90: ctx.transform(0, 1, -1, 0, height , 0); break;
					case 180: ctx.transform(-1, 0, 0, -1, width, height); break;
					case 270: ctx.transform(0, -1, 1, 0, 0, width); break;
				}
			}
			else {
				// tricky non-right-angle resize
				var rads = opts.rotate * Math.PI / 180;
				var c = Math.cos(rads);
				var s = Math.sin(rads);
				if (s < 0) { s = -s; }
				if (c < 0) { c = -c; }
				
				this.set('width', Math.ceil( (height * s) + (width * c) ));
				this.set('height', Math.ceil( (height * c) + (width * s) ));
				
				this.logDebug(5, "Setting new width/height for rotate " + opts.rotate + ": " + this.width() + 'x' + this.height());
				
				// recreate canvas at new size
				this.create(opts);
				ctx = this.context;
				ctx.save();
				
				// set origin point to center
				ctx.translate( this.width() / 2, this.height() / 2 );
				
				// do the needful
				ctx.rotate( rads );
				
				// reverse the translate for drawImage origin
				ctx.translate( -width / 2, -height / 2 );
			}
		} // rotate
		else {
			// other misc transform (no canvas resize)
			ctx.clearRect( 0, 0, width, height );
			
			// fill background if desired
			if (opts.background) {
				ctx.save();
				ctx.fillStyle = opts.background;
				ctx.fillRect( 0, 0, width, height );
				ctx.restore();
			}
			
			// save canvas state
			ctx.save();
			
			// set origin point to center
			ctx.translate( width / 2, height / 2 );
			
			if (opts.rotate) {
				ctx.rotate( opts.rotate * Math.PI / 180 );
			}
			else if (opts.fliph) {
				ctx.scale( -1, 1 );
			}
			else if (opts.flipv) {
				ctx.scale( 1, -1 );
			}
			else if (opts.matrix) {
				// See: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform
				ctx.transform.apply( ctx, opts.matrix );
			}
			
			// reverse the translate for drawImage origin
			ctx.translate( -width / 2, -height / 2 );
		}
		
		// apply antialias if specified
		if (opts.antialias) {
			this.applyAntialias( opts.antialias );
		}
		
		// draw clone onto self
		ctx.drawImage(clone.canvas, 0, 0);
		
		// restore original canvas state
		ctx.restore();
		
		this.perf.end('transform');
		this.logDebug(6, "Transform complete");
		return this;
	},
	
	rotate: function(deg) {
		// shortcut
		return this.transform({ rotate: deg });
	},
	
	flipHorizontal: function() {
		// shortcut
		return this.transform({ fliph: true });
	},
	
	flipVertical: function() {
		// shortcut
		return this.transform({ flipv: true });
	}
	
});
