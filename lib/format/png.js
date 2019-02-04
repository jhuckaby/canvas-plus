// canvas-plus - Image Transformation Engine
// PNG Output Format Mixin
// Copyright (c) 2017 Joseph Huckaby
// Released under the MIT License

var zlib = require('zlib');
var Class = require("pixl-class");
var CRC32 = require('crc-32');
var toBuffer = require('blob-to-buffer');

// PNG file format chunk type ids
var chunkTypes = {
	TYPE_IHDR: 0x49484452,
	TYPE_IEND: 0x49454e44,
	TYPE_IDAT: 0x49444154,
	TYPE_PLTE: 0x504c5445,
	TYPE_tRNS: 0x74524e53,
	TYPE_gAMA: 0x67414d41
};

var packChunk = function(type, data) {
	// pack one chunk of PNG data (len, type, data, CRC32 checksum)
	// returns new buffer
	var len = (data ? data.length : 0),
	buf = Buffer.alloc(len + 12);
	
	buf.writeUInt32BE(len, 0);
	buf.writeUInt32BE(type, 4);
	
	if (data) data.copy(buf, 8);
	
	buf.writeInt32BE( CRC32.buf(buf.slice(4, buf.length - 4)), buf.length - 4 );
	
	return buf;
};

module.exports = Class.create({
	
	output_png: function(callback) {
		// output image in PNG format to buffer
		// support both RGBA and indexed
		var self = this;
		var mode = this.get('mode');
		var width = this.get('width');
		var height = this.get('height');
		var buf;
		
		if (mode == 'image') {
			// if we're still in image mode convert to canvas
			if (this.render().isError) return callback( this.getLastError() );
			mode = this.get('mode');
		}
		
		// we need either a canvas or indexed pixels to continue
		if (!this.canvas && !this.pixels) {
			return this.doError('png', "No image to compress", callback);
		}
		
		if (mode == 'rgba') {
			// simple rgba to png, use node-canvas
			if (this.get('useDataURLs')) {
				this.logDebug(6, "Compressing into 32-bit PNG format (using browser)" );
				
				var buf = Buffer.from( this.canvas.toDataURL('image/jpeg').split(',')[1], 'base64' );
				this.logDebug(6, "PNG compression complete");
				return callback(false, buf);
			}
			else if (this.canvas.toBlob) {
				// use standard HTML5 API
				this.logDebug(6, "Compressing into 32-bit PNG (using browser)" );
				
				this.canvas.toBlob( 
					function(blob) {
						// got Blob, now convert to Buffer
						toBuffer(blob, function (err, buf) {
							if (err) return self.doError('png', "PNG Encode Error: " + err, callback);
							self.logDebug(6, "PNG compression complete");
							callback(null, buf);
						});
					},
					'image/png'
				);
			}
			else {
				// use node-canvas API
				var opts = { compressionLevel: this.get('compressionLevel'), filters: this.get('pngFilter') };
				this.logDebug(6, "Compressing into 32-bit PNG", opts );
				
				opts.filters = this.canvas[this.get('pngFilter')];
				buf = this.canvas.toBuffer('image/png', opts );
				
				this.logDebug(6, "PNG compression complete");
				return callback(false, buf);
			}
		}
		else if (mode == 'indexed') {
			// not-so-simple indexed bitmap to PNG, gotta do it ourselves
			var iq_colors = this.palette;
			var iq_pixels = this.pixels;
			
			this.logDebug(6, "Compressing into 8-bit PNG", { compression: this.get('compressionLevel') } );
			
			// first, build PNG palette structure
			var palette_offset = 0;
			var palette_data = new Uint8Array( iq_colors.length * 3 );
			var alpha_data = new Uint8Array( iq_colors.length );
			var iq_color = null;
			
			for (var idx = 0, len = iq_colors.length; idx < len; idx++) {
				iq_color = iq_colors[idx];
				palette_data[ (palette_offset * 3) + 0 ] = iq_color.r;
				palette_data[ (palette_offset * 3) + 1 ] = iq_color.g;
				palette_data[ (palette_offset * 3) + 2 ] = iq_color.b;
				alpha_data[ palette_offset ] = iq_color.a;
				palette_offset++;
			}
			
			// next, build PNG pixel array (different than raw pixel array, has extra byte per row)
			var src_offset = 0;
			var pixel_offset = 0;
			var pixel_data = new Uint8Array( (width * height) + height ); // added extra 'height' for stupid filter bytes on each row
			
			for (var y = 0, ymax = height; y < ymax; y++) {
				// foreach row
				pixel_data[ pixel_offset++ ] = 0; // add filter byte
				
				for (var x = 0, xmax = width; x < xmax; x++) {
					// for each pixel
					pixel_data[ pixel_offset++ ] = iq_pixels[ src_offset++ ];
				} // x loop
			} // y loop
			
			// start building png file structure
			var chunks = [];
			
			// file signature (PNG magic number)
			chunks.push( Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) );
			
			// IHDR header chunk
			buf = Buffer.alloc(13);
			
				buf.writeUInt32BE(width, 0);
				buf.writeUInt32BE(height, 4);
				
				buf[8] = 8; // 8-bit depth
				buf[9] = 3; // indexed colorType
				buf[10] = 0; // gzip compression (yes, 0 = gzip)
				buf[11] = 0; // no filter (useless for indexed palette images)
				buf[12] = 0; // no interlace
			
			chunks.push( packChunk(chunkTypes.TYPE_IHDR, buf) );
			
			// PLTE palette chunk
			chunks.push( packChunk(chunkTypes.TYPE_PLTE, Buffer.from(palette_data.buffer) ) );
			
			// tRNS alpha chunk (only if alpha)
			if (this.get('alpha')) {
				chunks.push( packChunk(chunkTypes.TYPE_tRNS, Buffer.from(alpha_data.buffer) ) );
			}
			
			// IDAT data chunk
			chunks.push( packChunk(chunkTypes.TYPE_IDAT, zlib.deflateSync( Buffer.from(pixel_data.buffer), {
				level: this.get('compressionLevel'),
				memLevel: 9,
				strategy: zlib.constants ? zlib.constants.Z_RLE : zlib.Z_RLE
				// From zlib.net: Z_RLE is designed to be almost as fast as Z_HUFFMAN_ONLY, but give better compression for PNG image data.
			} )) );
			
			// IEND end chunk
			chunks.push( packChunk(chunkTypes.TYPE_IEND, null) );
			
			// concat chunks into single buffer
			var pngBuffer = Buffer.concat(chunks);
			
			// and we're done!
			this.logDebug(6, "PNG compression complete");
			callback( false, pngBuffer );
			
		} // indexed
		else {
			return this.doError('png', "Invalid image mode: " + mode, callback);
		}
	}
	
});
