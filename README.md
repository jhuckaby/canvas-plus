# Overview

CanvasPlus is a universal Node.js and browser library, which adds image processing capabilities onto the [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API).  In Node.js we rely on the amazing [canvas](https://www.npmjs.com/package/canvas) module, which is built on the [Cairo](https://www.cairographics.org/) graphics library.  In the browser we simply extend (well, wrap) the native canvas.

Check out our [live demo playground](https://jhuckaby.github.io/canvas-plus-playground/) to try out the library in your favorite browser.

## Features

- Load images from buffers, files or URLs
- Resize with special modes including cover, contain, and letterbox
- Render text with extra features
	- Multi-line, paragraph text
	- Custom character spacing and line spacing
	- Word-wrap
	- Auto-scale to fit line or paragraph
- Quantization into indexed mode for PNGs and GIFs
	- Optional dithering
	- Super-fast quantize mode
- Curves
	- Similar to Adobe Photoshop's Curves filter
	- Optionally apply different curves to each channel
	- Macro functions including Posterize, Solarize, Invert, Gamma, Sepia, etc.
- Adjust hue, saturation, brightness, contrast and color temperature
- Normalize (Auto-Enhance)
- Generate histogram data
- Access EXIF Metadata
- Auto-Orient
- Convolution Kernel
	- Macro functions including Emboss, Find Edges, Blur, Gaussian Blur, Sharpen
- Crop images
	- Manual or automatic based on corner pixel
- Rotation and flip horizontal / vertical
- Save as JPEG, PNG or GIF
	- True support for indexed palette PNGs and GIFs
	- True support for alpha PNGs, even indexed alpha

## Why

There are already some extremely cool image processing libraries out there.  I played with several, but none of them provided all the features I needed.  Specifically, I needed fast JPEG load and save, fast resize, TrueType / OpenType font support, advanced text rendering features like word wrap and auto-scale, quantization to 8-bit indexed mode with dithering, and curves.  I also wanted a universal library that worked in the browser as well as Node.js.  That being said, I want to recommend some amazing free libraries that you should absolutely check out:

| Library | Notes |
|---------|-------|
| [LWIP](https://github.com/EyalAr/lwip) | Very nice, fast engine with a clean API.  Only missing text rendering, curves, and 8-bit quantization. |
| [JIMP](https://github.com/oliver-moran/jimp) | Incredible pure-JS engine that does just about everything.  However, JPEG load/save and resize are too slow for me.  Also, no TrueType / OpenType font support, and there are some licensing issues.  Otherwise this is very, very cool. |
| [Sharp](https://github.com/lovell/sharp) | Very fast (uses [libvips](https://github.com/jcupitt/libvips)), and cool SVG integration.  Missing text rendering, curves, 8-bit quantization, and browser support. |
| [GM](https://github.com/aheckmann/gm) | I love this library, but it actually just shells out to the command-line GraphicsMagick/ImageMagick binary, so there are some performance concerns.  Also, no advanced text features, no curves, and no browser support. |

## Table of Contents

<!-- toc -->
- [Usage](#usage)
	* [Node.js](#nodejs)
	* [Browser](#browser)
	* [Creating](#creating)
	* [Loading](#loading)
	* [Saving](#saving)
	* [Errors](#errors)
	* [Logging](#logging)
- [API](#api)
	* [General](#general)
		+ [create](#create)
		+ [load](#load)
			- [Auto-Orient](#auto-orient)
			- [loadRemote](#loadremote)
		+ [write](#write)
		+ [clone](#clone)
	* [Filters](#filters)
		+ [adjust](#adjust)
		+ [blur](#blur)
		+ [border](#border)
		+ [composite](#composite)
		+ [convolve](#convolve)
		+ [crop](#crop)
		+ [curves](#curves)
		+ [desaturate](#desaturate)
		+ [emboss](#emboss)
		+ [expand](#expand)
		+ [findEdges](#findedges)
		+ [flatten](#flatten)
		+ [gamma](#gamma)
		+ [gaussianBlur](#gaussianblur)
		+ [invert](#invert)
		+ [mask](#mask)
		+ [normalize](#normalize)
		+ [opacity](#opacity)
		+ [posterize](#posterize)
		+ [quantize](#quantize)
		+ [quantizeFast](#quantizefast)
		+ [resize](#resize)
		+ [sepia](#sepia)
		+ [sharpen](#sharpen)
		+ [solarize](#solarize)
		+ [temperature](#temperature)
		+ [text](#text)
			- [Fonts](#fonts)
			- [Text Overflow](#text-overflow)
		+ [threshold](#threshold)
		+ [transform](#transform)
		+ [trim](#trim)
	* [Accessors](#accessors)
		+ [getLastError](#getlasterror)
		+ [getMetrics](#getmetrics)
		+ [getPerf](#getperf)
		+ [getDimensions](#getdimensions)
		+ [getEXIF](#getexif)
		+ [getCanvas](#getcanvas)
		+ [getContext](#getcontext)
		+ [getPixels](#getpixels)
		+ [getPalette](#getpalette)
		+ [get](#get)
		+ [width](#width)
		+ [height](#height)
	* [Misc](#misc)
		+ [set](#set)
		+ [clearLastError](#clearlasterror)
		+ [attachLogAgent](#attachlogagent)
		+ [importImage](#importimage)
		+ [importCanvas](#importcanvas)
		+ [reset](#reset)
		+ [render](#render)
		+ [histogram](#histogram)
		+ [hash](#hash)
	* [Modes](#modes)
	* [Channels](#channels)
	* [Gravity](#gravity)
	* [Anti-Aliasing](#anti-aliasing)
	* [Clipping](#clipping)
	* [Parameters](#parameters)
		+ [Node Parameters](#node-parameters)
- [Development](#development)
- [Acknowledgments](#acknowledgments)
- [License](#license)

# Usage

## Node.js

Use [npm](https://www.npmjs.com/) to install the module:

```
npm install pixl-canvas-plus
```

Please note that the [canvas](https://www.npmjs.com/package/canvas) module dependency is a binary compiled library, which depends on [Cairo](https://www.cairographics.org/) being preinstalled on your machine.  See their [installation wiki](https://github.com/Automattic/node-canvas/wiki) for assistance.  That being said, [canvas](https://www.npmjs.com/package/canvas) v2.x comes with precompiled binaries for macOS, Windows and Linux, so it might just slip right in.

Here is a simple usage example:

```js
var CanvasPlus = require('pixl-canvas-plus');
var canvas = new CanvasPlus();

canvas.load( 'waterfall.jpg', function(err) {
	if (err) throw err;
	
	canvas.resize({
		"width": 640,
		"height": 480,
		"mode": "fit"
	});
	
	canvas.adjust({
		"brightness": -20,
		"contrast": 20
	});
	
	canvas.write({"format":"jpeg", "quality":90}, function(err, buf) {
		if (err) throw err;
		
		// 'buf' will be a binary buffer containing final image...
		require('fs').writeFileSync('my_image.jpg', buf);
	});
	
});
```

## Browser

For the browser we use the native built-in [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API), and there are no dependencies.  Simply download and host this pre-built file (compiled using [browserify](http://browserify.org/)) on your own web server:

```
https://raw.githubusercontent.com/jhuckaby/canvas-plus/master/canvas-plus.js
```

This will expose a global `CanvasPlus` class in the window object.  Here is how to use it:

```html
<script src="canvas-plus.js"></script>
<script>
	var canvas = new CanvasPlus();
	
	canvas.load( 'waterfall.jpg', function(err) {
		if (err) throw err;
		
		canvas.resize({
			"width": 640,
			"height": 480,
			"mode": "fit"
		});
		
		canvas.adjust({
			"brightness": -20,
			"contrast": 20
		});
		
		canvas.write({"format":"jpeg","quality":90}, function(err, buf) {
			if (err) throw err;
			
			// 'buf' will be a binary buffer containing final image...
			var blob = new Blob( [ buf ], { type: "image/jpeg" } );
			var object_url = URL.createObjectURL( blob );
			
			// insert new image into DOM
			var img = new Image();
			img.src = object_url;
			document.body.appendChild( img );
		});
		
	});
</script>
```

## Creating

To create a blank canvas, and optionally fill with a background color, you can pass arguments to the constructor, like this:

```js
var canvas = new CanvasPlus( 640, 480 );
var canvas = new CanvasPlus( 640, 480, "#FF0000" );
```

Or you can use the explicit [create()](#create) method:

```js
var canvas = new CanvasPlus();
canvas.create({
	width: 640,
	height: 480,
	background: "#FF0000"
});
```

The background color can be any CSS-compatible color string, including RGBA, e.g. `rgba(255, 0, 0, 0.5)`.

## Loading

You can load images from a variety of sources, including buffers, files and URLs.  JPEGs, PNGs and GIFs are supported, and possibly others depending on your environment:

| Environment | Sources | Image Formats |
|-------------|---------|---------------|
| **Node.js** | Buffer, File Path, URL | JPEG, PNG, GIF |
| **Browser** | ArrayBuffer, File, Blob, URL | JPEG, PNG, GIF, BMP, WebP (Chrome only) |

To load an image, pass the source (e.g. file path, URL) to the [load()](#load) method.  Please note that this is an asynchronous call, so you need to provide a callback, or you can use the promise / async / await pattern with Node 8+.  Example with callback:

```js
var canvas = new CanvasPlus();

canvas.load( 'waterfall.jpg', function(err) {
	if (err) throw err;
});
```

Or with Node 8+:

```js
try {
	await canvas.load( 'waterfall.jpg' );
}
catch (err) {
	// handle error here
}
```

In Node.js this example would look for a `waterfall.jpg` file on disk in the current directory.  In the browser this would be treated as a URL to `waterfall.jpg` relative to the current page.

Note that loading images in the browser requires that the file is hosted on the same domain as the page, or is hosted on a server that sends back proper [CORS headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).  However, if you need to load an image from a 3rd party URL that does not support CORS, you can use the special [loadRemote()](#loadremote) method.  This works well enough, but due to browser security restrictions we will not have access to the raw binary bytes, so features like [EXIF data](#getexif) and [Auto-Orient](#auto-orient) are not available.

## Saving

To save the contents of your canvas to a binary image format, use the [write()](#write) method.  This will compress the image into a JPEG, PNG or GIF, and provide you with a [Buffer](https://nodejs.org/api/buffer.html) object.  Please note that this is an asynchronous call, so you need to provide a callback, or you can use the promise / async / await pattern with Node 8+.  Example with callback:

```js
canvas.write({"format":"jpeg", "quality":90}, function(err, buf) {
	if (err) throw err;
	
	// 'buf' will be a binary buffer containing final image
});
```

Or with Node 8+:

```js
try {
	var buf = await canvas.write({"format":"jpeg", "quality":90});
	// 'buf' will be a binary buffer containing final image
}
catch (err) {
	// handle error here
}
```

Note that in the browser the buffer is provided using the [buffer](https://www.npmjs.com/package/buffer) module, which is is a subclass of [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array).  So there is no need to explicitly convert to typed array -- just use the buffer as you would a native Uint8Array.

## Errors

All filter functions are synchronous, so they do not follow the callback pattern.  So by default all filter methods do not throw (however you can enable this behavior if you want, see below).  Instead, they set an internal error state which you can query after the fact.  Example:

```js
canvas.adjust({
	"brightness": -20,
	"contrast": 20
});
if (canvas.getLastError()) {
	// an error occurred
	var err = canvas.getLastError();
}
```

This works even if you chain multiple filter calls together.  CanvasPlus will "abort" the chain on the first error.  Example:

```js
canvas.desaturate().normalize().solarize().sepia().rotate(45);

if (canvas.getLastError()) {
	// an error occurred
	var err = canvas.getLastError();
}
```

If you would prefer to use try/catch, you can enable `throw` mode by calling [set()](#set) before running any filters:

```js
canvas.set('throw', true);

try {
	canvas.adjust({
		"brightness": -20,
		"contrast": 20
	});
}
catch (err) {
	// an error occurred
}
```

## Logging

To enable basic debug logging, use the [set()](#set) method to enable the `debug` parameter.  Example:

```js
canvas.set('debug', true);
```

Example debug log, which is emitted using `console.log()` (and `console.error()` for errors):

```
[DEBUG] Setting property: debug: true
[DEBUG] Loading image data from file: 640x480.jpg 
[DEBUG] Loading image from buffer {"size":296673}
[DEBUG] Image ping: {"height":480,"width":640,"type":"jpg"}
[DEBUG] Setting property: width: 640 
[DEBUG] Setting property: height: 480 
[DEBUG] Setting property: format: jpg 
[DEBUG] Setting property: mode: image 
[DEBUG] Setting property: origWidth: 640 
[DEBUG] Setting property: origHeight: 480 
[DEBUG] Setting property: origFormat: jpg 
[DEBUG] Image load complete 
[DEBUG] Resizing image to target size: 320x240 {"mode":"Fit","gravity":"center","background":"","orig_width":640,"orig_height":480,"target_width":320,"target_height":240,"dest_width":320,"dest_height":240,"canvas_width":320,"canvas_height":240,"x":0,"y":0}
[DEBUG] Setting property: width: 320 
[DEBUG] Setting property: height: 240 
[DEBUG] Creating new canvas: 320x240 {"background":"(transparent)"}
[DEBUG] Setting property: mode: rgba 
[DEBUG] Canvas created successfully 
[DEBUG] Image resize complete 
[DEBUG] Adjusting image {"brightness":-20,"contrast":20,"hue":0,"saturation":0}
[DEBUG] Image adjustment complete 
[DEBUG] Setting property: file: out.png 
[DEBUG] Setting property: format: png 
[DEBUG] Compressing image to format: png 
[DEBUG] Compressing into 32-bit PNG {"compression":9,"filter":"PNG_ALL_FILTERS"}
[DEBUG] PNG compression complete 
[DEBUG] Image compression complete {"size":165279}
[DEBUG] Saving to file: out.png 
[DEBUG] Image write complete
```

In Node.js, you can attach a log agent compatible with our [pixl-logger](https://www.npmjs.com/package/pixl-logger) module, or write your own that implements the interface.  Example of the former:

```js
var Logger = require('pixl-logger');
var columns = ['hires_epoch', 'date', 'hostname', 'component', 'category', 'code', 'msg', 'data'];
var logger = new Logger( 'logs/debug.log', columns );

canvas.attachLogAgent( logger );
```

Example custom logger implementation:

```js
var logger = {
	debug: function(level, msg, data) {
		if (data) msg += " (" + JSON.stringify(data) + ")";
		console.log('[DEBUG]['+level+'] ' + msg);
	},
	error: function(code, msg, data) {
		if (data) msg += " (" + JSON.stringify(data) + ")";
		console.log('[ERROR]['+code+'] ' + msg);
	}
};

canvas.attachLogAgent( logger );
```

# API

## General

### create

The `create()` method creates a new blank canvas, or replaces one if it already exists.  It accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `width` | Integer | **(Required)** Canvas width in pixels. |
| `height` | Integer | **(Required)** Canvas height in pixels. |
| `background` | String | Optional background color (any CSS color string). |

Example use:

```js
canvas.create({
	width: 640,
	height: 480,
	background: "#FF0000"
});
```

The background color can be any CSS-compatible color string, including RGBA, e.g. `rgba(255, 0, 0, 0.5)`.  If omitted, the canvas is initialized to transparent black.

Canvases are always created in 32-bit RGBA mode.

### load

The `load()` method loads an image into CanvasPlus.  It accepts buffers, files and URLs.  For image formats, JPEGs, PNGs and GIFs are supported, and possibly others depending on your environment.  Please note that this is an asynchronous call, so you need to provide a callback as the 2nd argument.  Example use:

```js
canvas.load( 'waterfall.jpg', function(err) {
	if (err) throw err;
});
```

In Node.js this example would look for a `waterfall.jpg` file on disk in the current directory.  In the browser this would be treated as a URL to `waterfall.jpg` relative to the current page.

Alternatively you can import an existing canvas using [importCanvas()](#importcanvas), or an image object using [importImage()](#importimage).

#### Auto-Orient

By default, CanvasPlus will automatically orient (rotate) your image on load, so it is always right-side up.  This is accomplished by detecting the image's [EXIF data](https://en.wikipedia.org/wiki/Exif), if present, and reading the special orientation flag.  Many digital cameras do not fix image rotation when shots are taken, and instead simply include an EXIF flag in the files, indicating the camera's orientation.

If you do not want this behavior for some reason, you can disable the feature by calling [set()](#set) before loading your image, and disabling the `autoOrient` parameter.  Example:

```js
var canvas = new CanvasPlus();
canvas.set('autoOrient', false);

canvas.load( 'waterfall.jpg', function(err) {
	if (err) throw err;
});
```

#### loadRemote

The `loadRemote()` method is a special, browser-only API, which allows you to load 3rd party image URLs.  That is, images that are hosted on 3rd party domains, and do not provide proper [CORS headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS).  Example use:

```js
var url = "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/HTML5_logo_and_wordmark.svg/1024px-HTML5_logo_and_wordmark.svg.png";

canvas.loadRemote( url, function(err) {
	if (err) throw err;
});
```

Note that due to browser security restrictions we have no access to the raw binary bytes, so features like [EXIF data](#getexif) and [Auto-Orient](#auto-orient) are not available when using `loadRemote()`.

### write

The `write()` method will compress your canvas into a JPEG, PNG or GIF, and provide you with a [Buffer](https://nodejs.org/api/buffer.html) object.  Please note that this is an asynchronous call, so you need to provide a callback.

```js
canvas.write({"format":"jpeg", "quality":90}, function(err, buf) {
	if (err) throw err;
	
	// 'buf' will be a binary buffer containing final image
});
```

Note that in the browser the buffer is provided using the [buffer](https://www.npmjs.com/package/buffer) module, which is is a subclass of [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array). So there is no need to explicitly convert to typed array.  Just use the buffer as you would a native Uint8Array.

### clone

The `clone()` method makes a copy of your canvas, including the raw pixel data, settings and all.  This is a synchronous call, and the new cloned object is returned.  Example use:

```js
var copy = canvas.clone();
```

## Filters

All filter methods are synchronous, and do not require a callback.  You can also chain them together, like this:

```js
canvas.desaturate().brightness(-15).contrast(30).invert();
```

### adjust

**Live Demo:** [Adjust Brightness/Contrast](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=adjust/eyJicmlnaHRuZXNzIjotMTUsImNvbnRyYXN0IjozMH0%3D&f=png)

The `adjust()` method allows you to adjust the image hue, saturation, brightness, and/or contrast.  It accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `hue` | Integer | Adjust hue (-360 to 360). |
| `saturation` | Integer | Adjust saturation (-255 to 255). |
| `brightness` | Integer | Adjust brightness (-255 to 255). |
| `contrast` | Integer | Adjust contrast (-255 to 255). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.adjust({
	"brightness": -15,
	"contrast": 30
});
```

The following method shortcuts are provided for convenience:

| Method Name | Example |
|-------------|---------|
| `hue` | `canvas.hue( 180 );` |
| `saturation` | `canvas.saturation( -128 );` |
| `brightness` | `canvas.brightness( 64 );` |
| `contrast` | `canvas.contrast( 32 );` |

**Note**: If you want to completely desaturate an image, check out the [desaturate()](#desaturate) filter below, as it is considerably faster than using `adjust()`.

### blur

**Live Demo:** [Blur](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=blur/eyJhbW91bnQiOjV9&f=png)

The `blur()` method applies a simple [box blur](https://en.wikipedia.org/wiki/Box_blur) to your image, using a custom [convolution kernel](#convolve).  This is a fast blur filter, but isn't particularly high quality.  It accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `amount` | Integer | **(Required)** Blur amount (2 to 100). |
| `edges` | String | How to calculate out-of-bounds pixels, can be one of `repeat`, `wrap`, `mirror` or `discard` (case-insensitive).  Defaults to `repeat`. |
| `channels` | String | Which channels to apply the filter to, defaults to `rgba`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.blur({
	"amount": 5
});
```

**See Also**: [gaussianBlur()](#gaussianblur)

### border

**Live Demo:** [Border](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=border/eyJzaXplIjoxNSwiY29sb3IiOiIjZmZhYTAwIn0%3D&f=png)

The `border()` method draws a border around your canvas, with a custom size and color.  It accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `size` | Integer | **(Required)** Size of the border in pixels. |
| `color` | String | **(Required)** Color of the border (any CSS color string). |
| `mode` | String | **(Required)** Border render mode (`inside`, `center` or `outside`). |

The mode can be one of `inside` (draw on top of edge pixels), `outside` (expand canvas by border size), or `center` (draw border half inside, half outside).  The latter two modes will actually [expand](#expand) the canvas to accommodate the border.

Example use:

```js
canvas.border({
	"size": 5,
	"color": "#FF0000",
	"mode": "inside"
});
```

Note that transparent colors aren't supported for this filter.

### composite

**Live Demo:** [Composite](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=composite/e30%3D&f=png)

The `composite()` method superimposes a separate image or canvas atop the current one.  The source can be another CanvasPlus object, a native [HTML5 Canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas) object, or a native [Image](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img) object.  Several parameters are provided for positioning, scaling and setting the compositing mode.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `image` | Object | **(Required)** Source image or canvas to superimpose atop current canvas. |
| `width` | Integer | Optional desired width, will trigger a resize during composite. |
| `height` | Integer | Optional desired height, will trigger a resize during composite. |
| `gravity` | String | Image starting position (alignment), which can be further adjusted with margins and/or offsets.  See [Gravity](#gravity). |
| `marginX` | Integer | Horizontal margin in pixels, defaults to `0`. |
| `marginY` | Integer | Vertical margin in pixels, defaults to `0`. |
| `offsetX` | Integer | Horizontal offset in pixels, defaults to `0`. |
| `offsetY` | Integer | Vertical offset in pixels, defaults to `0`. |
| `opacity` | Float | Image opacity (0.0 to 1.0), defaults to `1.0`. |
| `mode` | String | Composite rendering mode, see [globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation), defaults to `source-over`. |
| `antialias` | String | Image scaling quality, one of `best`, `good`, `fast` or `nearest`.  Defaults to `best`.  See [Anti-Aliasing](#anti-aliasing). |

Example use:

```js
canvas.composite({
	"image": my_other_canvas,
	"gravity": "northwest",
	"marginX": 10,
	"marginY": 10
});
```

Note that when `width` and/or `height` are specified here, the image is resized in *exact* (scale) mode.

### convolve

**Live Demo:** [3x3 Sharpen Kernel](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=convolve/eyJtYXRyaXgiOlswLC0xLDAsLTEsNSwtMSwwLC0xLDBdfQ%3D%3D&f=png)

The `convolve()` method applies a custom [convolution kernel](https://en.wikipedia.org/wiki/Kernel_%28image_processing%29) to the canvas.  This is used to apply effects such as [blur](#blur), [sharpen](#sharpen), [emboss](#emboss), [find edges](#findedges), and more.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `matrix` | Array | **(Required)** An array of numbers for the convolution matrix.  The length should be a perfect square (e.g. 9, 16, 25). |
| `offset` | Integer | Optionally offset the destination channel values, causing a brightening effect (used by [emboss](#emboss)). |
| `edges` | String | How to calculate out-of-bounds pixels, can be one of `repeat`, `wrap`, `mirror` or `discard`.  Defaults to `repeat`. |
| `channels` | String | Which channels to apply the filter to, defaults to `rgba`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.convolve({
	"matrix": [ // 3x3 sharpen
		0, -1, 0, 
		-1, 5, -1, 
		0, -1, 0
	]
});
```

### crop

**Live Demo:** [Square Earth](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6ImVhcnRoLW5hc2EuanBnIn0%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjY0MCwibW9kZSI6ImZpdCJ9&t=crop/eyJ4IjoxNjAsInkiOjE2MCwid2lkdGgiOjMyMCwiaGVpZ2h0IjozMjB9&f=png)

The `crop()` method crops the canvas down to the specified size, at the specified coordinates (top-left corner).  All values are specified in pixels.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `x` | Integer | **(Required)** The coordinate of the left side of the crop rectangle. |
| `y` | Integer | **(Required)** The coordinate of the top side of the crop rectangle. |
| `width` | Integer | **(Required)** The width of the crop rectangle. |
| `height` | Integer | **(Required)** The width of the crop rectangle. |

Example use:

```js
canvas.crop({
	"x": 50,
	"y": 50,
	"width": 200,
	"height": 200
});
```

Note that cropping regenerates the underlying canvas object.  It effectively creates a new canvas at the final cropped size, then copies the source into the destination, then discards the source.

**See Also**: [trim()](#trim)

### curves

**Live Demo:** [Increase mid-tones](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDE5MSwyNTVdfQ%3D%3D&f=png) (see below for more)

The `curves()` method applies a [tonality curve](https://en.wikipedia.org/wiki/Curve_%28tonality%29) to all the pixels in your canvas.  You need only provide key points, and all the curve values are interpolated using [monotone cubic interpolation](https://en.wikipedia.org/wiki/Monotone_cubic_interpolation) (similar to how Photoshop does it).  Curves are used to implement all kinds of common image filters, including [gamma adjustment](#gamma), [inversion](#invert), [posterize](#posterize), [solarize](#solarize), [normalize](#normalize), [sepia](#sepia), and [color temperature](#temperature).  But here you can supply your own custom curve by specifying key points, including different curves per channel if desired.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `rgb` | Array | An array of curve points for the red, green and blue channels together (same curve applied to all). |
| `red` | Array | An array of curve points for the red channel specifically. |
| `green` | Array | An array of curve points for the green channel specifically. |
| `blue` | Array | An array of curve points for the blue channel specifically. |
| `alpha` | Array | An array of curve points for the alpha channel specifically. |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

You can specify the curve points in two ways.  First, a simple one-dimensional array of "Y" axis values (each 0 - 255), which are evenly distributed over the "X" axis, from darkest to lightest.  And second, an array of X/Y pairs specifying a more precise curve.  Example of the former:

```js
canvas.curves({
	"rgb": [0, 191, 255] // increase mid-tones
});
```

To better explain how this works, here is a table with some common curves, a visualization, and a live demo of each:

| Curve Points | Visualization | Description | Demo Link |
|--------------|---------------|-------------|-----------|
| `[0, 255]` | <img src="https://pixlcore.com/canvas-plus/images/0-255.png" width="192"> | Baseline (no change) | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDI1NV19&f=png) |
| `[63, 255]` | <img src="https://pixlcore.com/canvas-plus/images/63-255.png" width="192"> | Increase brightness | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOls2MywyNTVdfQ%3D%3D&f=png) |
| `[0, 127]` | <img src="https://pixlcore.com/canvas-plus/images/0-127.png" width="192"> | Decrease brightness | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDEyN119&f=png) |
| `[0, 0, 255, 255]` | <img src="https://pixlcore.com/canvas-plus/images/0-0-255-255.png" width="192"> | Increase contrast | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDAsMjU1LDI1NV19&f=png) |
| `[63, 191]` | <img src="https://pixlcore.com/canvas-plus/images/63-191.png" width="192"> | Decrease contrast | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOls2MywxOTFdfQ%3D%3D&f=png) |
| `[0, 191, 255]` | <img src="https://pixlcore.com/canvas-plus/images/0-191-255.png" width="192"> | Increase mid-tones | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDE5MSwyNTVdfQ%3D%3D&f=png) |
| `[0, 63, 255]` | <img src="https://pixlcore.com/canvas-plus/images/0-63-255.png" width="192"> | Decrease mid-tones | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDYzLDI1NV19&f=png) |
| `[0, 96, 160, 216, 255]` | <img src="https://pixlcore.com/canvas-plus/images/0-96-160-216-225.png" width="192"> | Increase shadow detail | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDk2LDE2MCwyMTYsMjU1XX0%3D&f=png) |
| `[255, 0]` | <img src="https://pixlcore.com/canvas-plus/images/255-0.png" width="192"> | Invert image | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlsyNTUsMF19&f=png) |
| `[0, 127, 0]` | <img src="https://pixlcore.com/canvas-plus/images/0-127-0.png" width="192"> | Solarize effect | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDEyNywwXX0%3D&f=png) |
| `[0, 255, 0, 255]` | <img src="https://pixlcore.com/canvas-plus/images/0-255-0-255.png" width="192"> | Alice in Wonderland | [Live Demo](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=curves/eyJwb2ludHMiOlswLDI1NSwwLDI1NV19&f=png) |

You can also specify different curves to each channel.  For example, here is one way to apply a sepia tone effect to an image:

```js
canvas.desaturate().curves({
	"green": [0, 108, 255],
	"blue": [0, 64, 255]
});
```

As mentioned above, you can alternatively specify an array of X/Y pairs for the key points, to describe a more precise curve.  Here is an example of that:

```js
canvas.curves({
	"rgb": [
		[0, 0],
		[32, 192],
		[255, 255]
	]
});
```

Note that if your point array contains exactly 256 elements, and is a simple one-dimensional array of integers, then no interpolation is performed, and the points are mapped *exactly* to each value as specified.

### desaturate

**Live Demo:** [Desaturate](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=desaturate/e30%3D&f=png)

The `desaturate()` method removes all color from your canvas, resulting in a pure grayscale image.  Instead of averaging the channels together, they are weighted in such a way that the grayscale output is more natural-looking (see [relative luminance](https://en.wikipedia.org/wiki/Luma_%28video%29#Use_of_relative_luminance)).

This is similar to calling [adjust()](#adjust) and setting the `saturation` to `-255`, however `desaturate()` is much faster.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```
canvas.desaturate();
```

### emboss

**Live Demo:** [Emboss](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=emboss/e30%3D&f=png)

The `emboss()` method applies an [emboss filter](https://en.wikipedia.org/wiki/Image_embossing) to the canvas, which is implemented using a 3x3 convolution kernel.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `channels` | String | Which channels to apply the filter to, defaults to `rgb`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.emboss();
```

This is equivalent to calling [desaturate()](#desaturate), followed by [convolve()](#convolve) with the following parameters:

```js
canvas.desaturate().convolve({ 
	matrix: [2, 0, 0, 0, -1, 0, 0, 0, -1], 
	offset: 127, 
	edges: 'repeat',
	channels: 'rgb'
});
```

### expand

**Live Demo:** [Expand](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=expand/eyJ3aWR0aCI6MTAwLCJoZWlnaHQiOjEwMCwiYmFja2dyb3VuZCI6InJnYmEoMCwgMCwgMCwgMCkiLCJncmF2aXR5IjoiY2VudGVyIn0%3D&f=png)

The `expand()` method increases the canvas size, while not resizing the image itself.  This is essentially a "reverse crop".  You can specify an alignment (gravity) for positioning the existing image on the expanded canvas, and an optional background color.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `width` | Integer | Number of pixels to increase the width by (this is a delta). |
| `height` | Integer | Number of pixels to increase the height by (this is a delta). |
| `gravity` | String | Image position (alignment) of pre-existing pixels on new expanded canvas.  See [Gravity](#gravity). |
| `background` | String | Background color for canvas expansion (any CSS color string).  Fully transparent if omitted. |

Example use:

```js
canvas.expand({
	"width": 100,
	"height": 100,
	"gravity": "center"
});
```

This would *increase* the canvas size by 100px horizontally and vertically, essentially adding a 50px transparent border on all sides of the image.

Note that expanding regenerates the underlying canvas object.  It effectively creates a new canvas at the expanded size, then copies the source into the destination, then discards the source.

### findEdges

**Live Demo:** [Find Edges](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6InN1bnNldC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=findEdges/e30%3D&f=png)

The `findEdges()` method applies a [Sobel operator](https://en.wikipedia.org/wiki/Sobel_operator) to the canvas, resulting in a strong highlight of all the apparent edges in the image.  This uses a 3x3 convolution kernel.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `channels` | String | Which channels to apply the filter to, defaults to `rgb`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.findEdges();
```

This is equivalent to calling [desaturate()](#desaturate), followed by [convolve()](#convolve) with the following parameters:

```js
canvas.desaturate().convolve({ 
	matrix: [-1, -1, -1, -1, 8, -1, -1, -1, -1], 
	offset: 0, 
	edges: 'repeat',
	channels: 'rgb'
});
```

### flatten

**Live Demo:** [Flatten](https://jhuckaby.github.io/canvas-plus-playground/?t=load/e30%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=flatten/eyJiYWNrZ3JvdW5kIjoiI2ZmZmZmZiJ9&f=png)

The `flatten()` method effectively removes the alpha channel from your canvas, resulting in a fully opaque image.  Of course, the alpha channel still technically exists, as all canvases are RGBA, but this allows you to remove all transparency.  You can choose to place a background color matte behind the image, or simply set the direct alpha values to 255.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `background` | String | Optional background color (any CSS color string). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.flatten({
	"background": "#000000"
});
```

When a `background` is specified, the underlying canvas object is regenerated.  The library effectively creates a new canvas with the specified background color, superimposes the source onto the destination, then discards the source.

If you omit the `background` property (or it evaluates to `false`) then the alpha pixel values are all set to 255 in a direct sense.  This may expose otherwise "hidden" visual elements in your image, depending on how it was encoded.

Note that flattening the canvas sets an internal `alpha` flag to `false`, which indicates that PNG and GIF output should not contain any alpha information.  You can manually get/set this flag using [get()](#get) and [set()](#set), although you should rarely need to.

### gamma

**Live Demo:** [Gamma Adjust](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=gamma/eyJhbW91bnQiOjIuMn0%3D&f=png)

The `gamma()` method applies a [gamma correction](https://en.wikipedia.org/wiki/Gamma_correction) curve to your canvas.  Values less than 1.0 will lighten the image, whereas values greater than 1.0 will darken it.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `amount` | Float | Gamma correction value, typically in the range `0.25` to `4.0`.  The default value is `1.0` (no change). |
| `channels` | String | Which channels to apply the filter to, defaults to `rgb`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.gamma({
	"amount": 0.5
});
```

### gaussianBlur

**Live Demo:** [Gaussian Blur](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=gaussianBlur/eyJhbW91bnQiOjZ9&f=png)

The `gaussianBlur()` method applies a [Gaussian blur](https://en.wikipedia.org/wiki/Gaussian_blur) to your image, using a custom [convolution kernel](#convolve).  This is a rather computationally expensive filter, but is much higher quality than the standard [blur](#blur).  It accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `amount` | Integer | **(Required)** Blur amount (3 to 100). |
| `sigma` | Integer | Gaussian sigma operator (defaults to `amount / 3`). |
| `edges` | String | How to calculate out-of-bounds pixels, can be one of `repeat`, `wrap`, `mirror` or `discard` (case-insensitive).  Defaults to `repeat`. |
| `channels` | String | Which channels to apply the filter to, defaults to `rgba`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

The `amount` is really just the size of one dimension of the [Gaussian convolution matrix](https://en.wikipedia.org/wiki/Gaussian_blur#Sample_Gaussian_matrix) (it is squared to compute the full matrix size), so the larger the `amount` the slower the operation is.  The `sigma` actually controls the amount of blurring that occurs.  For best results, set `sigma` to 1/3 of `amount` (this is the default behavior if `sigma` is omitted).

Example use:

```js
canvas.gaussianBlur({
	"amount": 9
});
```

### invert

**Live Demo:** [Invert](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=invert/e30%3D&f=png)

The `invert()` method inverts all colors in the image (i.e. creates a photographic negative), or can be restricted to certain specified channels.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `channels` | String | Which channels to apply the filter to, defaults to `rgb`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.invert();
```

Inversion is implemented using a [curve](#curves), and is functionally equivalent to calling:

```js
canvas.curves({
	"rgb": [255, 0]
});
```

### mask

**Live Demo:** [Apply Mask](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=mask/e30%3D&f=png)

The `mask()` method applies a separate image or canvas as a mask onto the current one.  Meaning, the alpha channel of one is applied to the other.  The source can be another CanvasPlus object, a native [HTML5 Canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas) object, or a native [Image](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img) object.  Several parameters are provided for positioning and scaling the mask.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `image` | Object | **(Required)** Source image or canvas to apply as a mask. |
| `width` | Integer | Optional desired width, will trigger a resize during composite. |
| `height` | Integer | Optional desired height, will trigger a resize during composite. |
| `gravity` | String | Image starting position (alignment), which can be further adjusted with margins and/or offsets.  See [Gravity](#gravity). |
| `marginX` | Integer | Horizontal margin in pixels, defaults to `0`. |
| `marginY` | Integer | Vertical margin in pixels, defaults to `0`. |
| `offsetX` | Integer | Horizontal offset in pixels, defaults to `0`. |
| `offsetY` | Integer | Vertical offset in pixels, defaults to `0`. |
| `opacity` | Float | Mask opacity (0.0 to 1.0), defaults to `1.0`. |
| `antialias` | String | Mask scaling quality, one of `best`, `good`, `fast` or `nearest`.  Defaults to `best`.  See [Anti-Aliasing](#anti-aliasing). |

Example use:

```js
canvas.mask({
	"image": my_mask_image,
	"gravity": "center"
});
```

Masking is effectively the same as calling [composite()](#composite) with the `mode` set to `destination-in`.

Note that when `width` and/or `height` are specified, the mask is resized in *exact* (scale) mode.

### normalize

**Live Demo:** [Normalize](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6InN1bnNldC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=normalize/e30%3D&f=png)

The `normalize()` method stretches the image contrast to cover the entire range of possible values.  So for example, if the image never reaches full back and/or full white, this will increase the contrast so both sides are maxed.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `channels` | String | Which channels to apply the filter to, defaults to `rgb`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.normalize();
```

Normalize is implemented by requesting a [histogram](#histogram) to locate the white and black points, and then applying a custom [curve](#curves).

### opacity

**Live Demo:** [Half Transparent](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=opacity/eyJvcGFjaXR5IjowLjV9&f=png)

The `opacity()` method fades the canvas out towards pure transparent, or a custom background color.  The method accepts an opacity float, or an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `opacity` | Float | The target image opacity from `0.0` (transparent) to `1.0` (opaque). |
| `background` | String | Optional background color, defaults to transparent. |

Example use:

```js
canvas.opacity({
	opacity: 0.5,
	background: 'red'
});
```

If you are only specifying opacity (no background), you can just pass the number as the sole argument:

```js
canvas.opacity( 0.5 );
```

### posterize

**Live Demo:** [Posterize](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=posterize/e30%3D&f=png)

The `posterize()` method reduces the image to a limited number of color levels per channel.  Smaller level amounts have the most obvious effect.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `levels` | Integer | **(Required)** Number of levels to allow per channel. |
| `channels` | String | Which channels to apply the filter to, defaults to `rgb`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.posterize({
	"levels": 4
});
```

Posterize is implemented using a custom stair-step [curve](#curves). 

### quantize

**Live Demo:** [Quantize](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=quantize/eyJjb2xvcnMiOjEyOCwiZGl0aGVyIjp0cnVlfQ%3D%3D&f=png)

The `quantize()` method reduces your image to a fixed number of unique colors, then generates a palette and converts the canvas into [indexed mode](#modes).  This is used for saving GIFs and indexed PNGs.  We rely on the awesome [image-q](https://www.npmjs.com/package/image-q) library here, which is slow but produces beautiful results.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `colors` | Integer | **(Required)** Number of unique colors in the palette (2 - 256). |
| `dither` | Boolean | Dither option for quantization.  Defaults to `false` (disabled). |
| `ditherType` | String | Dithering algorithm for quantization.  Defaults to `FloydSteinberg`. |

Example use:

```js
canvas.quantize({
	"colors": 32,
	"dither": true
});
```

Quantize should always be the *last* filter applied before calling [write()](#write).  Calling any other filters after quantization will convert the canvas back to RGBA mode, which is likely not what you want.

The supported dithering algorithms are `FloydSteinberg`, `Stucki`, `Atkinson`, `Jarvis`, `Burkes`, and `Sierra`.  They each have different trade-offs, and produce slightly different results.  See [Dithering Algorithms](https://en.wikipedia.org/wiki/Dither#Algorithms) for more information.

Note that quantization includes and preserves alpha transparency in the palette, unless you first [flatten](#flatten) your canvas.

### quantizeFast

**Live Demo:** [Quantize Fast](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=quantizeFast/eyJjcnVzaFJHQiI6NiwiY3J1c2hBbHBoYSI6NiwiZGl0aGVyIjp0cnVlfQ%3D%3D&f=png)

The `quantizeFast()` method works similarly to [quantize()](#quantize), in that it reduces your image to a fixed number of unique colors, then generates a palette and converts the canvas into [indexed mode](#modes).  However, this version is approximately 10X faster.  It does this by "crushing" (a.k.a [posterizing](#posterize)) the image, optionally dithering it, then simply building a palette of all unique colors.  This generally produces lower quality results than [quantize()](#quantize) (depending on the image), but at a fraction of the CPU cost.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `crushRGB` | Integer | Number of posterization levels for the RGB channels, defaults to `0`. |
| `crushAlpha` | Integer | Number of posterization levels for the Alpha channel, defaults to `0`. |
| `dither` | Boolean | Optional pattern dither, defaults to `false` (disabled). |
| `fallback` | Boolean | Optional fallback to [quantize()](#quantize) if image has too many colors, defaults to `false` (disabled). |

Example use:

```js
canvas.quantizeFast({
	"crushRGB": 6,
	"dither": true
});
```

It is important to note that you cannot specify the exact number of colors you want in your palette with `quantizeFast()`.  The algorithm builds its own palette based on the total unique colors after "crushing" (posterizing) the image.  You can control the level of posterization of course, and adjust it differently for the RGB and Alpha channels.  The higher the `crushRGB` and `crushAlpha` values are, the more unique colors are produced.  Also, while dithering is provided here as an option, only a [pattern dither](https://en.wikipedia.org/wiki/Ordered_dithering) is supported.

When the `fallback` feature is enabled, the library will automatically switch over to [quantize()](#quantize) if the fast algorithm fails.  Meaning, if there are too many unique colors after crushing is complete.  The image must have 256 or fewer colors for quantization to work, and the fast algorithm cannot guarantee this outcome.  It all depends on how complex and varied the image colors are, and how many crush levels are used.  When `fallback` is disabled and the image ends up with more than 256 colors, an error is raised (see [Errors](#errors)).

Note that quantization includes and preserves alpha transparency in the palette, unless you first [flatten](#flatten) your canvas.

### resize

**Live Demo:** [Resize](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&f=png)

The `resize()` method scales the canvas to the desired pixel width and/or height.  Several modes are available, to control how your image is scaled to fit the target dimensions.  You can also control the gravity (alignment), direction (e.g. shrink only, enlarge only), and anti-alias settings.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `width` | Integer | Desired canvas width in pixels.  Can be omitted if `height` is specified. |
| `height` | Integer | Desired canvas height in pixels.  Can be omitted if `width` is specified. |
| `mode` | String | Resize mode, one of `fit`, `fitPad`, `fitOver` or `scale` (case-insensitive).  Defaults to `fit`.  See below. |
| `background` | String | Background padding color, for `fitPad` mode only. |
| `gravity` | String | Image alignment, which can be further adjusted with offsets.  See [Gravity](#gravity). |
| `direction` | String | Resize direction restriction, one of `shrink`, `enlarge`, or `both`.  Defaults to `both`. |
| `antialias` | String | Resize scaling quality, one of `best`, `good`, `fast` or `nearest`.  Defaults to `best`.  See [Anti-Aliasing](#anti-aliasing). |
| `offsetX` | Integer | Horizontal offset in pixels, defaults to `0`. |
| `offsetY` | Integer | Vertical offset in pixels, defaults to `0`. |
| `delta` | Boolean | Interpret `width` and `height` as delta offsets, not absolute values.  Defaults to `false`. |

Example use:

```js
canvas.resize({
	"width": 640,
	"height": 480,
	"mode": "fit"
});
```

If either `width` or `height` are omitted, they will be extrapolated from the other, maintaining the original aspect ratio.  Here is an example which scales the canvas down to 50% width, maintaining its aspect ratio:

```js
canvas.resize({
	"width": canvas.get('width') / 2
});
```

Here is a description of all the available resize modes:

| Resize Mode | Alias | Description |
|-------------|-------|-------------|
| `fit` | `contain` | The default mode.  Will resize so the image "fits" into the destination width/height without exceeding either value, and maintaining the original aspect ratio.  Similar to the CSS [background-size: contain](https://developer.mozilla.org/en-US/docs/Web/CSS/background-size) rule. |
| `fitPad` | `letterbox` | This mode scales the image similar to `fit`, but then adds background padding to fill in the extra area (if any), so the final image size exactly matches your desired dimensions, but the original image aspect ratio is also preserved.  This is similar to [film letterboxing](https://en.wikipedia.org/wiki/Letterboxing_%28filming%29).  The `background` property controls the padding color, and `gravity` controls the image alignment. |
| `fitOver` | `cover` | This mode scales the image in such a way that it fits "over" the destination width/height, covering the entire area.  The aspect ratio is maintained, and the extra content is cropped off.  This is similar to the CSS [background-size: cover](https://developer.mozilla.org/en-US/docs/Web/CSS/background-size) rule. |
| `scale` | `exact` | This mode scales the image to your *exact* specifications, ignoring the aspect ratio, and distorting as needed. |

Note that resizing regenerates the underlying canvas object.  It effectively creates a new canvas at the target size, then copies the source into the destination, applying the resize at the same time, then finally discards the source.

### sepia

**Live Demo:** [Sepia Tone](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=sepia/e30%3D&f=png)

The `sepia()` method applies a [sepia tone](https://en.wikipedia.org/wiki/Photographic_print_toning#Sepia_toning) filter to your image, using a custom curve.  This is a commonly used filter which gives a photograph an "old western" look.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example:

```js
canvas.sepia();
```

This is equivalent to calling [desaturate()](#desaturate), followed by [curves()](#curves) using the following properties:

```js
canvas.desaturate().curves({
	green: [0, 108, 255],
	blue: [0, 64, 255]
});
```

### sharpen

**Live Demo:** [Sharpen](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=sharpen/e30%3D&f=png)

The `sharpen()` method applies a simple sharpen effect to your image, using a custom 3x3 [convolution kernel](#convolve).  It accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `edges` | String | How to calculate out-of-bounds pixels, can be one of `repeat`, `wrap`, `mirror` or `discard` (case-insensitive).  Defaults to `repeat`. |
| `channels` | String | Which channels to apply the filter to, defaults to `rgba`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.sharpen({
	"edges": "repeat"
});
```

This is equivalent to calling [convolve()](#convolve) with the following properties:

```js
canvas.convolve({ 
	"matrix": [0, -1, 0, -1, 5, -1, 0, -1, 0],
	"edges": "repeat"
});
```

### solarize

**Live Demo:** [Solarize](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=solarize/e30%3D&f=png)

The `solarize()` method applies a [solarisation](https://en.wikipedia.org/wiki/Solarisation) filter to your canvas, which basically inverts all colors above half brightness.  This can be restricted to certain specified channels if desired.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `channels` | String | Which channels to apply the filter to, defaults to `rgb`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.solarize();
```

Solarisation is implemented using a custom sawtooth inverted-V [curve](#curves), and is similar to calling:

```js
canvas.curves({
	"rgb": [0, 127, 0]
});
```

However, the `solarize()` method uses a 256-element curve array, with an exact sawtooth inverted-V shape.

### temperature

**Live Demo:** [Color Temperature](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=temperature/eyJhbW91bnQiOi0xMjh9&f=png)

The `temperature()` method simulates increasing or decreasing the image's [color temperature](https://en.wikipedia.org/wiki/Color_temperature).  Increasing the temperature produces a "warmer" (redder) image, and decreasing it produces a "cooler" (bluer) image.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `amount` | Integer | Amount to increase or decrease temperature.  Range is `-255` to `255`. |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.temperature({
	"amount": -128
});
```

This is a very simple implementation of color temperature, which applies a [curve](#curves) to increase the red or blue channels in a linear fashion, based on the supplied `amount`.  This filter is only for visual effect, and doesn't pertain to any photographic or color standard.  I'm sure there are *much* better and more accurate algorithms out there.

### text

**Live Demos:** [Basic Meme](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=text/eyJ0ZXh0IjoiTklDRSBXQVRFUkZBTEwgQlJPIiwiZm9udCI6IkFyaWFsIE5hcnJvdyIsImZvbnRXZWlnaHQiOiJib2xkIiwic2l6ZSI6NDgsImNvbG9yIjoiI2ZmZmZmZiIsImdyYXZpdHkiOiJzb3V0aCIsIm1hcmdpblgiOjEwLCJtYXJnaW5ZIjoxMCwib3V0bGluZUNvbG9yIjoiIzAwMDAwMCIsIm91dGxpbmVUaGlja25lc3MiOjR9&f=png), [Auto-Shrink](https://jhuckaby.github.io/canvas-plus-playground/?t=create/eyJ3aWR0aCI6NjAwLCJoZWlnaHQiOjIwMCwiYmFja2dyb3VuZCI6IiNmZmZmZmYifQ%3D%3D&t=text/eyJ0ZXh0IjoiVGhpcyB0ZXh0IG5vcm1hbGx5IHdvdWxkbid0IGZpdCBvbiBvbmUgbGluZS4iLCJmb250IjoiQXJpYWwgQmxhY2siLCJzaXplIjoyMDAsImNvbG9yIjoicmdiYSgyNTUsIDAsIDAsIDEuMCkiLCJncmF2aXR5IjoiY2VudGVyIn0%3D&f=png), [Word-Wrap](https://jhuckaby.github.io/canvas-plus-playground/?t=create/eyJ3aWR0aCI6MjAwLCJoZWlnaHQiOjIwMCwiYmFja2dyb3VuZCI6IiNmZmZmZmYifQ%3D%3D&t=text/eyJ0ZXh0IjoiTm93IGlzIHRoZSB0aW1lIGZvciBhbGwgZ29vZCBtZW4gdG8gY29tZSB0byB0aGUgYWlkIG9mIHRoZWlyIGNvdW50cnkuICBUaGUgcXVpY2sgYnJvd24gZm94IGp1bXBzIG92ZXIgdGhlIGxhenkgZG9nLiAgR3J1bXB5IFdpemFyZHMgbWFrZSB0b3hpYyBicmV3IGZvciB0aGUgRXZpbCBRdWVlbiBhbmQgSmFjay4gIExvcmVtIGlwc3VtIGRvbG9yIHNpdCBhbWV0LCBjb25zZWN0ZXR1ciBhZGlwaXNpY2luZyBlbGl0LCBzZWQgZG8gZWl1c21vZCB0ZW1wb3IgaW5jaWRpZHVudCB1dCBsYWJvcmUgZXQgZG9sb3JlIG1hZ25hIGFsaXF1YS4iLCJmb250IjoiQXJpYWwiLCJzaXplIjoxOCwiY29sb3IiOiIjMDAwMDAwIiwiZ3Jhdml0eSI6Im5vcnRod2VzdCIsIm92ZXJmbG93Ijoid3JhcCIsIm1hcmdpblgiOjEwLCJtYXJnaW5ZIjoxMH0%3D&f=png), [Shrink-Wrap](https://jhuckaby.github.io/canvas-plus-playground/?t=create/eyJ3aWR0aCI6MjAwLCJoZWlnaHQiOjIwMCwiYmFja2dyb3VuZCI6IiNmZmZmZmYifQ%3D%3D&t=text/eyJ0ZXh0IjoiTm93IGlzIHRoZSB0aW1lIGZvciBhbGwgZ29vZCBtZW4gdG8gY29tZSB0byB0aGUgYWlkIG9mIHRoZWlyIGNvdW50cnkuICBUaGUgcXVpY2sgYnJvd24gZm94IGp1bXBzIG92ZXIgdGhlIGxhenkgZG9nLiAgR3J1bXB5IFdpemFyZHMgbWFrZSB0b3hpYyBicmV3IGZvciB0aGUgRXZpbCBRdWVlbiBhbmQgSmFjay4gIExvcmVtIGlwc3VtIGRvbG9yIHNpdCBhbWV0LCBjb25zZWN0ZXR1ciBhZGlwaXNpY2luZyBlbGl0LCBzZWQgZG8gZWl1c21vZCB0ZW1wb3IgaW5jaWRpZHVudCB1dCBsYWJvcmUgZXQgZG9sb3JlIG1hZ25hIGFsaXF1YS4iLCJmb250IjoiQXJpYWwiLCJzaXplIjoxOCwiY29sb3IiOiIjMDAwMDAwIiwiZ3Jhdml0eSI6Im5vcnRod2VzdCIsIm92ZXJmbG93Ijoic2hyaW5rd3JhcCIsIm1hcmdpblgiOjEwLCJtYXJnaW5ZIjoxMH0%3D&f=png)

The `text()` method renders text onto your canvas.  Beyond the built-in features of the [HTML5 Canvas Text API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_text), we provide both character and line spacing, automatic scaling to fit, word-wrap, and the almighty paragraph word-wrap + auto-shrink combo.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `text` | String | **(Required)** Actual text to render (can be multi-line). |
| `font` | String | **(Required)** Font file path (Node.js) or font family name (browser).  See [Fonts](#fonts). |
| `size` | Integer | **(Required)** Text size, measured in points (often equivalent to height in pixels, depending on font family). |
| `color` | String | **(Required)** Text color (any CSS color string). |
| `background` | String | Optional background color (any CSS color string), defaults to transparent. |
| `gravity` | String | Text alignment, which can be further adjusted with margins and/or offsets.  See [Gravity](#gravity). |
| `overflow` | String | How to handle text overflow.  See [Text Overflow](#text-overflow). |
| `marginX` | Integer | Horizontal margin in pixels, defaults to `0`. |
| `marginY` | Integer | Vertical margin in pixels, defaults to `0`. |
| `offsetX` | Integer | Horizontal offset in pixels, defaults to `0`. |
| `offsetY` | Integer | Vertical offset in pixels, defaults to `0`. |
| `maxWidth` | Integer | Maximum text render width in pixels, defaults to canvas width (minus margins). |
| `maxHeight` | Integer | Maximum text render height in pixels, defaults to canvas height (minus margins). |
| `characterSpacing` | Float | Adjust horizontal space between each character, with sub-pixel precision.  Specify values less than 0 to condense, and greater than 0 to expand. |
| `lineSpacing` | Float | Adjust vertical space between each line, with sub-pixel precision.  Specify values less than 0 to condense, and greater than 0 to expand. |
| `shadowColor` | String | Optional shadow color (any CSS color string), defaults to empty string (disabled). |
| `shadowOffsetX` | Integer | When `shadowColor` is specified, this controls the horizontal offset of the shadow (default to 0). |
| `shadowOffsetY` | Integer | When `shadowColor` is specified, this controls the vertical offset of the shadow (defaults to 0). |
| `shadowBlur` | Integer | When `shadowColor` is specified, this controls the shadow blur amount (defaults to 0). |
| `outlineColor` | String | Optional text outline color (any CSS color string), defaults to empty string (disabled). |
| `outlineThickness` | Integer | When `outlineColor` is specified, this controls the thickness of the outline. |
| `outlineStyle` | String | When `outlineColor` is specified, this controls the style of the outline (see [lineJoin](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineJoin). |
| `autoCrop` | String | Optionally crop canvas down to rendered text size, can be `horiz`, `vert` or `both`.  Defaults to disabled. |
| `opacity` | Float | Text opacity (0.0 to 1.0), defaults to `1.0`. |
| `mode` | String | Text rendering mode, see [globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation), defaults to `source-over`. |

#### Fonts

When specifying fonts via the `font` property, please note that things are handled differently if you are running in a browser, vs. using Node.js on the server-side.  For Node.js, you need to specify a filesystem path to the font file, in either OpenType (OTF) or TrueType (TTF) format, and preload the font using `loadFont()` before creating the canvas (see below).  The font weight and style are expected to be embedded into the file itself, e.g. `Arial-Narrow-bold.otf` or `Helvetica-bold-italic.ttf`.  Example:

```js
// Node.js text example
var canvas = new CanvasPlus();
canvas.loadFont( "/path/to/fonts/Arial-Narrow-bold.otf" ); // do this first!
canvas.create({
	width: 640,
	height: 480,
	background: "#FFFFFF"
});

canvas.text({
	"text": "Hello there, Node.js!",
	"font": "/path/to/fonts/Arial-Narrow-bold.otf",
	"size": 48,
	"color": "#ffffff",
	"gravity": "south",
	"marginX": 10,
	"marginY": 10,
	"outlineColor": "#000000",
	"outlineThickness": 4
});
```

Note that you **must** load all fonts before creating the canvas in which they will be used.  This is a limitation of node-canvas v2.  See [registerFont](https://github.com/Automattic/node-canvas#registerfont) for details.

When running CanvasPlus in the browser, things are a bit different.  You must specify a CSS font family instead, e.g. `Arial Narrow`.  This can be any built-in system font, or a custom web font that you loaded previously (make sure it is completely loaded before using in CanvasPlus).  In addition, if you want to specify a font weight or style, please use the special browser-only `fontWeight` and/or `fontStyle` properties, respectively.  Example:

```js
// Browser-specific text example
canvas.text({
	"text": "Hello there, browser!",
	"font": "Arial Narrow", // CSS font-family
	"fontWeight": "bold", // CSS font-weight
	"fontStyle": "normal", // CSS font-style
	"size": 48,
	"color": "#ffffff",
	"gravity": "south",
	"marginX": 10,
	"marginY": 10,
	"outlineColor": "#000000",
	"outlineThickness": 4
});
```

As a convenience, a special version of `loadFont()` is made available for use in the browser.  It accepts a font family name, a URL, and an optional callback.  The callback will be fired when the font is completely loaded and ready to use.  Example:

```js
// browser font loading example
canvas.loadFont( "Open Sans", "fonts/open-sans-regular.woff2", function(err) {
	if (err) throw err;
	// font is ready to use!
} );
```

#### Text Overflow

When your text does not fit into the available width/height (this is the canvas size minus margins and adjusted by `maxWidth` and/or `maxHeight`), you have several options on how to handle the overflow.  The behavior is controlled by the `overflow` property, which accepts one of the following values:

| Overflow Value | Description |
|----------------|-------------|
| `""` | The default behavior is to take no action on overflow, and simply render the text outside the bounds. |
| `"shrink"` | This mode will automatically shrink the text until it fits, both horizontally and vertically. |
| `"wrap"` | This mode will apply automatic word-wrapping to prevent horizontal overflow (it disregards vertical). |
| `"shrinkWrap"` | This mode will apply both word-wrapping and auto-scale to provide the best fit into the available width/height. |

Example use:

```js
canvas.text({
	"text": "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
	"font": "/path/to/fonts/Arial-italic.otf",
	"size": 12,
	"color": "rgba(255, 0, 0, 1.0)",
	"gravity": "northwest",
	"overflow": "shrinkwrap",
	"marginX": 10,
	"marginY": 10
});
```

Note that while `shrink` is very fast, both `wrap` and `shrinkWrap` are rather computationally expensive operations, because they need to flow your text into a smaller space that it was designed for.  `shrinkWrap` in particular is extremely expensive, because it has to constantly re-flow and re-wrap the text as it shrinks, and also it cannot always provide perfectly accurate fits (it always errs on the small side tho).  You can help these algorithms by providing a starting font `size` property that is "somewhat close" to what you will think will fit.  This way it doesn't have to work so hard.

Also note that when a single word cannot fit on a line, it is broken into pieces.  Automatic hyphenation is not supported, nor is "justify".

One final gotcha is that both the wrapper algorithms require that the text rendered at your provided base `size` must fit at least one character from your text, or else the entire operation aborts.

### threshold

**Live Demos:** [Color Threshold](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=threshold/e30%3D&f=png), [Black & White Threshold](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=desaturate/e30%3D&t=threshold/e30%3D&f=png)

The `threshold()` method applies a [threshold filter](https://en.wikipedia.org/wiki/Thresholding_%28image_processing%29) to your image, which essentially minimizes or maximizes the value of selected channels in each pixel, if the value is above or below a threshold level.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `level` | Integer | Threshold level.  Range is `0` to `255`. |
| `channels` | String | Which channels to apply the filter to, defaults to `rgb`.  See [Channels](#channels). |
| `clip` | Object | Optional clipping rectangle (see [Clipping](#clipping) below). |

Example use:

```js
canvas.threshold({
	"level": 128,
	"channels": "rgb"
});
```

For a more classic black & white threshold effect, simply call [desaturate()](#desaturate) before thresholding:

```js
canvas.desaturate().threshold({
	"level": 128,
	"channels": "rgb"
});
```

### transform

**Live Demos:** [Rotate 45 Degrees](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=transform/eyJyb3RhdGUiOjQ1fQ%3D%3D&f=png), [Custom Matrix](https://jhuckaby.github.io/canvas-plus-playground/?t=load/eyJpbWFnZSI6IndhdGVyZmFsbC5qcGcifQ%3D%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=transform/eyJtYXRyaXgiOlsxLDAsMSwxLDAsMF19&f=png)

The `transform()` method applies transformations to your canvas, which can include rotation, horizontal or vertical flipping, or a custom [3x3 transformation matrix](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform).  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `rotate` | Float | Optional degrees to rotate image.  If divisible by 90, image dimensions are shifted around to fit. |
| `flipH` | Boolean | Optional flip horizontal transformation. |
| `flipV` | Boolean | Optional flip vertical transformation. |
| `matrix` | Array | Optional [3x3 transformation matrix](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform), for custom distortions. |
| `background` | String | Background color to use when expanding canvas, defaults to transparent. |
| `antialias` | String | Image scaling quality, one of `best`, `good`, `fast` or `nearest`.  Defaults to `best`.  See [Anti-Aliasing](#anti-aliasing). |
| `fixed` | Boolean | Set this to `true` to keep the canvas width/height fixed, instead of auto-expanding them.  Only applicable for rotation. |

Example use:

```js
canvas.transform({
	"rotate": 45
});
```

Only one transformation is allowed per call to `transform()`.

Note that when rotating, if the degrees are exactly `90` or `270`, the canvas width and height are swapped, so the image fits exactly into the new container.  For all other non-90-degree-angles, the canvas remains the same size, and the image is spun around the center.  You can call [expand()](#expand) to pre-extend the canvas to make more room.

The following transform method shortcuts are provided for convenience:

| Method Name | Example |
|-------------|---------|
| `rotate` | `canvas.rotate( 45 );` |
| `flipHorizontal` | `canvas.flipHorizontal();` |
| `flipVertical` | `canvas.flipVertical();` |

### trim

**Live Demo:** [Trim Transparent Edges](https://jhuckaby.github.io/canvas-plus-playground/?t=load/e30%3D&t=resize/eyJ3aWR0aCI6NjQwLCJoZWlnaHQiOjQ4MCwibW9kZSI6ImZpdCJ9&t=trim/e30%3D&f=png)

The `trim()` method automatically crops the canvas based on a custom color if provided, or the value of the top-left pixel if not.  For example, if the top-left corner pixel is pure transparent, then all transparent pixels are cropped from all sides.  You can also specify a `tolerance` to allow similar colors from being trimmed.  The method accepts an object containing the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `color` | String | Optional color to trim.  If omitted, will use top-left corner pixel. |
| `tolerance` | Integer | How much pixel value difference to allow when trimming, from `0` to `255`.  Defaults to `0`. |

Example (will trim based on top-left pixel):

```js
canvas.trim();
```

Example with specific trim color and tolerance:

```js
canvas.trim({
	color: "rgba(255, 0, 0, 1.0)",
	tolerance: 32
});
```

This filter will silently fail if no pixels are available for trimming, or if it is about to trim the entire image.

## Accessors

### getLastError

The `getLastError()` method returns the last error that occurred, or `null` if the last operation was a success.

See [Errors](#errors) for details.

### getMetrics

The `getMetrics()` method returns an object that contains performance metrics for all operations that have taken place.  This uses the [pixl-perf](https://www.npmjs.com/package/pixl-perf) module, and all metrics are in milliseconds.  The format is as follows:

```js
{
	"scale": 1000,
	"perf": {
		"total": 217.399,
		"download": 3.7,
		"read": 8.8,
		"resize": 0.6,
		"adjust": 61.299,
		"convolve": 41.6,
		"curves": 15.3,
		"desaturate": 11.3,
		"write": 18.1
	},
	"counters": {
		"bytes_read": 1040704,
		"bytes_written": 82510
	}
}
```

### getPerf

The `getPerf()` method returns the current performance tracking object, which is from the [pixl-perf](https://www.npmjs.com/package/pixl-perf) module.  This is so you can add your own metrics to it.

### getDimensions

The `getDimensions()` method returns an object with the current canvas `width` and `height` in pixels.  Example:

```js
{
	"width": 640,
	"height": 480
}
```

### getEXIF

The `getEXIF()` method returns an object containing all the parsed [EXIF](https://en.wikipedia.org/wiki/Exif) metadata obtained from the image when it was first loaded.  This is only applicable if you loaded an image (as opposed to a blank canvas), and it also only works for JPEG images.  Example snippet of data:

```js
{
	"Make": "Apple",
	"Model": "iPhone 7",
	"Orientation": 1,
	"XResolution": 72,
	"YResolution": 72,
	"ResolutionUnit": 2,
	"Software": "10.3.1",
	"DateTime": "2017:04:29 16:36:23",
	...
}
```

We use the awesome [exif-js](https://www.npmjs.com/package/exif-js) module for parsing this data.

Please note that if you want to capture EXIF data from images, you should do it immediately after loading.  Any transforms or filters that rebuild the canvas will scrub the EXIF data.

### getCanvas

The `getCanvas()` method returns the underlying [HTML5 Canvas](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement) object currently in use by CanvasPlus.  Please note that this is only applicable in RGBA mode (see [Modes](#modes) below), and that the canvas is often discarded and rebuilt by many filters and transforms.

### getContext

The `getContext()` method returns the underlying [CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) object currently in use by CanvasPlus.  Please note that this is only applicable in RGBA mode (see [Modes](#modes) below), and that the context is often discarded and rebuilt by many filters and transforms.

### getPixels

The `getPixels()` method returns a direct pointer to the raw pixels in the current canvas.  The format varies depending on the current mode (see [Modes](#modes) below).

In `rgba` mode, `getPixels()` returns a [Uint8ClampedArray](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8ClampedArray) of RGBA pixels, obtained from the `data` property of the current canvas [ImageData](https://developer.mozilla.org/en-US/docs/Web/API/ImageData).  Each element in the array is one 8-bit channel value of one pixel, and every 4 elements is one full 32-bit pixel.  Example:

```js
var width = canvas.get('width');
var height = canvas.get('height');
var data = canvas.getPixels();
var offset = 0;

for (var y = 0; y < height; y++) {
	// foreach row
	for (var x = 0; x < width; x++) {
		// for each pixel
		var red = data[ offset + 0 ];
		var green = data[ offset + 1 ];
		var blue = data[ offset + 2 ];
		var alpha = data[ offset + 3 ];
		offset += 4;
	} // x loop
} // y loop
```

In `indexed` mode, `getPixels()` returns a [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) of 8-bit palette indexes.  Each value will be between 0 and 255, representing an index in the palette array.  See [getPalette()](#getpalette) below.  Example:

```js
canvas.quantize({ colors: 256, dither: true });

var width = canvas.get('width');
var height = canvas.get('height');
var pixels = canvas.getPixels();
var colors = canvas.getPalette();
var offset = 0;

for (var y = 0; y < height; y++) {
	// foreach row
	for (var x = 0; x < width; x++) {
		// for each pixel
		var color = colors[ pixels[offset] ];
		var red = color.r;
		var green = color.g;
		var blue = color.b;
		var alpha = color.a;
		offset++;
	} // x loop
} // y loop
```

If `getPixels()` is called while in `image` mode, the canvas is converted to `rgba` first.

### getPalette

The `getPalette()` method returns an array of indexed palette colors.  This is only applicable in `indexed` mode (see [Modes](#modes) below).  The palette array may contain up to 256 colors, and each array element is an object containing the following properties:

| Property Name | Description |
|---------------|-------------|
| `r` | Red channel value, from 0 - 255. |
| `g` | Green channel value, from 0 - 255. |
| `b` | Blue channel value, from 0 - 255. |
| `a` | Alpha channel value, from 0 - 255. |
| `uint32` | A 32-bit integer value representing the palette color as a "pixel". |

To convert your canvas into `indexed` mode, call [quantize()](#quantize) or [quantizeFast()](#quantizefast).

### get

The `get()` method is a generic accessor for fetching named parameters on the CanvasPlus object.  Using this you can retrieve the current canvas width, height, image mode, and more.  Many are used as defaults for filters.  See [Parameters](#parameters) below for the full list.  Example:

```js
var width = canvas.get('width');
var height = canvas.get('height');
```

### width

The `width()` method is an alias for `get('width')`.  It returns the current canvas width in pixels.  Example:

```js
var width = canvas.width();
```

### height

The `height()` method is an alias for `get('height')`.  It returns the current canvas height in pixels.  Example:

```js
var height = canvas.height();
```

## Misc

### set

The `set()` method sets an arbitrary named parameter on the CanvasPlus object.  Using this you can disable features such as automatic EXIF rotation correction, enable debug mode, and more.  See [Parameters](#parameters) below for the full list.  Example:

```js
canvas.set( 'autoOrient', false ); // do not auto-rotate based on EXIF data
canvas.set( 'debug', true ); // output debugging data to console
```

### clearLastError

The `clearLastError()` method clears the previous error state, if any.  Afterwards, [getLastError()](#getlasterror) will return `null`.  This method is called internally by every filter and transform just prior to executing.

### attachLogAgent

The `attachLogAgent()` method allows you to attach your own debug and error logging agent (object).  The object should have `debug` and `error` methods defined, which accept three arguments (`code`, `message`, and `data`).  See [Logging](#logging) above for more details and an example implementation.

### importImage

The `importImage()` method allows you to import your own native HTML [Image](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement) object into CanvasPlus.  Please note that the image *must* be completely loaded before importing, otherwise an error will be raised.  Example use:

```js
var img = new Image();
img.onload = function() {
	canvas.importImage( img );
};
img.src = "my-image.jpg";
```

The canvas will be completely replaced with the image, and inherit its exact width, height, and content.  This also sets the internal [mode](#modes) to `image`.

### importCanvas

The `importCanvas()` method allows you to import your own native HTML5 [Canvas](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement) object into CanvasPlus.  Example:

```js
canvas.importCanvas( document.getElementById('mycanvas') );
```

The canvas used by CanvasPlus will be completely replaced with the new canvas, and inherit its exact width, height, and content.  This also sets the internal [mode](#modes) to `rgba`.

### reset

The `reset()` method completely resets CanvasPlus, removing all pixels, data and reverting settings to defaults.  It is effectively the same as destroying and recreating the object.  Example:

```js
canvas.reset();
```

### render

The `render()` method converts CanvasPlus into `rgba` mode, rendering the internal image or indexed pixels onto the canvas.  This is only applicable when in `image` or `indexed` mode (see [Modes](#modes) below), and is called automatically by most filters and transforms.  You should rarely need to call it directly, but it is provided just in case.  Example:

```js
canvas.render();
```

### histogram

The `histogram()` method generates an [image histogram](https://en.wikipedia.org/wiki/Image_histogram) of the current canvas pixels, returning an object with the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `red` | Array | An array of all the red histogram counts per value. |
| `green` | Array | An array of all the green histogram counts per value. |
| `blue` | Array | An array of all the blue histogram counts per value. |
| `alpha` | Array | An array of all the alpha histogram counts per value. |
| `redMax` | Integer | The maximum red value across all the array elements. |
| `greenMax` | Integer | The maximum green value across all the array elements. |
| `blueMax` | Integer | The maximum blue value across all the array elements. |
| `alphaMax` | Integer | The maximum alpha value across all the array elements. |

Example use:

```js
var histo = canvas.histogram();
```

For example, let's say you had an image that contained a large amount of pure black (`rgb(0, 0, 0)`).  Your histogram would therefore contain high numbers for the first (zeroth) array indexes in each color channel.  The array indexes are the color channel brightnesses, and the values are the counts of pixels in that specific brightness slice.  In this case `histo.red[0]`, `histo.green[0]` and `histo.blue[0]` would all contain high numbers, because those elements are literally "counts" of the darkest pixels.

You can use the `redMax`, `greenMax` and `blueMax` properties to determine the maximum slice counts across the arrays.  These maximums can be used to normalize the data and scale it down to fit into a 2D histogram display (see the [playground](https://jhuckaby.github.io/canvas-plus-playground/) for an example of this).

The histogram feature only works in `rgba` mode (see [Modes](#modes) below), and will convert the canvas into RGBA if necessary.

### hash

The `hash()` method generates a [perceptual hash](https://en.wikipedia.org/wiki/Perceptual_hashing) of the current canvas pixels, using the fast [Blockhash](http://blockhash.io/) algorithm.  This is basically a unique ID or thumbprint for the image, represented as a 16-character hexadecimal string, which is *almost always* the same when compared to similar images.  Example use:

```js
var hash = canvas.hash();
// "02fe3c3c7ca2471b"
```

The basic idea with these hash IDs is that you can compare them using a [Hamming distance](https://en.wikipedia.org/wiki/Hamming_distance), and see exactly how similar two images are.  CanvasPlus provides a `hammingDistance()` method for you to use for this purpose.  Here is an example:

```js
// compute initial hash
var hash1 = canvas.hash();

// filter image
canvas.adjust({
	brightness: -40,
	contrast: 40,
	hue: 180,
	saturation: 50
});

// compute new hash
var hash2 = canvas.hash();

// get hamming distance
var dist = canvas.hammingDistance( hash1, hash2 );

console.log("Initial Image Hash: " + hash1);
console.log("Final Image Hash:   " + hash2);
console.log("hash Distance: " + dist);
```

Example output:

```
Initial Image Hash: 02fe3c3c7c92471b
Final Image Hash:   02fe3c3c7ca2471b
Hash Distance: 2
```

Note that the [Blockhash](http://blockhash.io/) algorithm has some limitations:

> For images in general, the algorithm generates the same blockhash value for two different images in 1% of the cases (data based on a random sampling of 100,000 images).

> For photographs, the algorithm generates practically unique blockhashes, but for icons, clipart, maps and other images, the algorithm generates less unique blockhashses. Larger areas of the same color in an image, either as a background or borders, result in hashes that collide more frequently.

The CanvasPlus `hash()` method only works in `rgba` mode (see [Modes](#modes) below), and will convert the canvas into RGBA if necessary.

## Modes

CanvasPlus has three internal "modes" which specify how your image data is represented in memory:

| Mode | Description |
|------|-------------|
| `image` | This mode is set when an image is loaded, but not yet rendered onto a canvas.  [load()](#load) sets this mode. |
| `rgba` | This mode means the pixels are stored in a RGBA canvas.  This is the primary mode of operation.  [create()](#create) sets this mode. |
| `indexed` | This mode is only set when the image is [quantized](#quantize), and is only used for outputting a GIF or indexed PNG image. |

Modes are automatically changed according to how the library is used.  For example, all filters require an RGBA canvas, so the mode is automatically converted to `rgba` if necessary.  Only [quantize()](#quantize) and [quantizeFast()](#quantizefast) convert the mode to `indexed`.

If you request access to the underlying canvas object via [getCanvas()](#getcanvas) or [getContext()](#getcontext), and the canvas is in either `image` or `indexed` mode, it is converted back to `rgba`.  [getPixels()](#getpixels) works with both `rgba` and `indexed` modes.

The reason why `image` mode exists is that the first filter applied after loading is very often a [resize()](#resize), and it is much faster to delay rendering of the image until resize time, so it can be done in one single operation.

You can use [get()](#get) to query the current mode, but you should rarely need to.

## Channels

CanvasPlus works in "RGBA" mode, which stands for Red, Green, Blue, and Alpha.  Many filters can customize which channels they are applied to, and take a single `channels` property.  This property is a string, which expects the abbreviated form of the channels to act upon, e.g. `rgba` for all channels including alpha.  Here are some more examples:

| Channels | Description |
|----------|-------------|
| `rgba` | Apply to all color channels including the alpha channel (red, green, blue and alpha). |
| `rgb` | Apply to only the RGB color channels (red, green and blue) excluding the alpha channel. |
| `r` | Apply to only the red channel. |
| `g` | Apply to only the green channel. |
| `b` | Apply to only the blue channel. |
| `a` | Apply to only the alpha channel. |
| `gb` | Apply to the green and blue channels only. |
| `ra` | Apply to the red and alpha channels only. |

## Gravity

Here are all the possible `gravity` parameter values, and what they mean.  Note that all gravity strings are case-insensitive.

| Gravity Value | Alias | Description |
|---------------|-------|-------------|
| `center` | - | Center both horizontally and vertically.  This is typically the default. |
| `northwest` | `topleft` | Pin to top-left corner. |
| `north` | `top` | Pin to top, center horizontally. |
| `northeast` | `topright` | Pin to top-right corner. |
| `east` | `right` | Pin to right side, center vertically. |
| `southeast` | `bottomright` | Pin to bottom-right corner. |
| `south` | `bottom` | Pin to bottom, center horizontally. |
| `southwest` | `bottomleft` | Pin to bottom-left corner. |
| `west` | `left` | Pin to left side, center vertically. |

## Anti-Aliasing

The `antialias` parameter is used by several filters including [resize](#resize), [transform](#transform), [composite](#composite) and [mask](#mask).  Here are all the possible `antialias` parameter values, and what they mean.  Note that this is highly implementation-dependent, as in your results may vary between browsers and Node.js [canvas](https://www.npmjs.com/package/canvas).  All strings are case-insensitive.  The default is always `best`.

| Value | Description |
|-------|-------------|
| `best` | Highest quality setting, but also the slowest.  In the browser `imageSmoothingEnabled` is enabled and `imageSmoothingQuality` is set to `high`. |
| `good` | Medium quality setting. In the browser `imageSmoothingEnabled` is enabled and `imageSmoothingQuality` is set to `medium`. |
| `fast` | Low quality setting. In the browser `imageSmoothingEnabled` is enabled and `imageSmoothingQuality` is set to `low`. |
| `nearest` | Lowest quality setting, but also the fastest.  In the browser `imageSmoothingEnabled` is disabled. |

The word `nearest` refers to [nearest-neighbor interpolation](https://en.wikipedia.org/wiki/Nearest-neighbor_interpolation), and results in pixelated transforms (no anti-aliasing).

## Clipping

Many methods accept a `clip` property, which allows you to optionally restrict the filter to a rectangle inside the canvas.  This is similar to the marquee rectangle selection tool in many paint apps.  If specified, `clip` should be an object with the following properties:

| Property Name | Type | Description |
|---------------|------|-------------|
| `x` | Integer | Coordinate of the left side of the clipping rectangle. |
| `y` | Integer | Coordinate of the top side of the clipping rectangle. |
| `width` | Integer | Width of the clipping rectangle, in pixels. |
| `height` | Integer | Height of the clipping rectangle, in pixels. |

Example use:

```js
canvas.sepia({
	clip: { x: 50, y: 50, width: 100, height: 100 }
});
```

## Parameters

Here are all the general parameters you can access using [get()](#get) and change using [set()](#set):

| Parameter Name | Type | Description |
|----------------|------|-------------|
| `autoOrient` | Boolean | Automatically correct image rotation on load, using EXIF data.  Defaults to `true` (enabled). |
| `throw` | Boolean | Enables try/catch mode (will throw on error).  Defaults to `false` (disabled).  Only recommended in Node 7+. |
| `debug` | Boolean | Enables debug logging mode using `console.log` and `console.error`.  Defaults to `false` (disabled). |
| `gravity` | String | Default gravity (alignment) for filters such as [composite()](#composite), [expand()](#expand), [resize()](#resize) and [text()](#text).  Defaults to `center`. |
| `colors` | Integer | Default number of palette colors for quantization.  Defaults to `256`. |
| `dither` | Boolean | Default dither option for quantization.  Defaults to `false` (disabled). |
| `ditherType` | String | Default dither algorithm for quantization.  Defaults to `FloydSteinberg`. |
| `alpha` | Boolean | Flag indicating whether canvas contains alpha (transparent) pixels or not.  Used by GIF and PNG output. |
| `mode` | String | Current [internal mode](#modes) of the canvas.  Do not change this manually. |
| `width` | Number | Current canvas width in pixels.  Do not change this manually (use [resize()](#resize)). |
| `height` | Number | Current canvas height in pixels.  Do not change this manually (use [resize()](#resize)). |

### Node Parameters

The following parameters are only applicable in Node.js, when using the [canvas](https://www.npmjs.com/package/canvas) module:

| Parameter Name | Type | Description |
|----------------|------|-------------|
| `progressive` | Boolean | Optionally save JPEGs in progressive scan mode.  Defaults to `false`. |
| `chromaSubsampling` | Boolean | Optionally save JPEGs with [chroma subsampling](https://en.wikipedia.org/wiki/Chroma_subsampling).  Defaults to `true`. |
| `compressionLevel` | Integer | Compression level for PNG images.  Defaults to `6`. |
| `pngFilter` | String | PNG filter algorithm, for 32-bit PNG images.  Defaults to `PNG_ALL_FILTERS`.  See below. |

The `pngFilter` parameter specifies the algorithm for preparing the PNG data for compression.  The available values are: `PNG_ALL_FILTERS`, `PNG_FILTER_SUB`, `PNG_FILTER_UP`, `PNG_FILTER_AVG`, `PNG_FILTER_PAETH`, and `PNG_FILTER_NONE`.  This is only applicable for writing 32-bit PNGs.  See the [PNG Filter Spec](https://www.w3.org/TR/PNG-Filters.html) for more information.

# Development

To compile the browser version of the library from the Node.js source, you will need to have [browserify](http://browserify.org/) installed.  Then change into the main package directory and type:

```
npm run browserify
```

This should generate the `canvas-plus.js` standalone file.

# Acknowledgments

CanvasPlus would not be possible without these awesome libraries:

| Module Name | Description | License |
|-------------|-------------|---------|
| [canvas](https://www.npmjs.com/package/canvas) | Cairo backed Canvas implementation for Node.js. | MIT |
| [image-q](https://www.npmjs.com/package/image-q) | Complete Image Quantization Library | MIT |
| [omggif](https://www.npmjs.com/package/omggif) | GIF 89a encoder and decoder | MIT |
| [exif-js](https://www.npmjs.com/package/exif-js) | Read EXIF meta data from image files. | MIT |
| [browserify](https://www.npmjs.com/package/browserify) | Browser-side require() the node.js way | MIT |

Also, special thanks go to:

- Matt Lockyer's [Gaussian Blur Convolution Kernel Generator](https://github.com/mattlockyer/iat455/blob/master/assignment1/assignment/effects/blur-effect-dyn.js), (c) [Matt Lockyer](https://github.com/mattlockyer/iat455), MIT License
- The [Monotone Cubic Interpolation](https://en.wikipedia.org/wiki/Monotone_cubic_interpolation) article on Wikipedia, and sample code therein.
- The [TinyColor](https://github.com/bgrins/TinyColor) library, (c) [Brian Grinstead](http://briangrinstead.com), MIT License.
- The [onFontReady](https://github.com/dwighthouse/onfontready) library, (c) [Dwight House](https://github.com/dwighthouse), MIT License.
- The [Blockhash](http://blockhash.io/) algorithm and JS code, (c) 2014 [Commons Machinery](http://commonsmachinery.se/), MIT License.
- [Stack Overflow](https://stackoverflow.com/)
- [Mozilla Developer Network (MDN)](https://developer.mozilla.org/en-US/)

# License

The MIT License (MIT)

Copyright (c) 2017 - 2019 Joseph Huckaby.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
