// Polyfill for TextEncoder/TextDecoder in Node.js environment
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock HTMLCanvasElement.prototype.toBlob for JSDOM
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.toBlob = function(callback, mimeType, quality) {
    // Create a mock blob
    const blob = new Blob(['mock-image-data'], { type: mimeType || 'image/png' });
    // Call the callback asynchronously to mimic real behavior
    setTimeout(() => callback(blob), 0);
  };

  HTMLCanvasElement.prototype.getContext = function(contextType) {
    if (contextType === '2d') {
      return {
        fillRect: () => {},
        clearRect: () => {},
        getImageData: (x, y, w, h) => ({
          data: new Array(w * h * 4)
        }),
        putImageData: () => {},
        createImageData: () => [],
        setTransform: () => {},
        drawImage: () => {},
        save: () => {},
        fillText: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        translate: () => {},
        scale: () => {},
        rotate: () => {},
        arc: () => {},
        fill: () => {},
        measureText: () => ({ width: 0 }),
        transform: () => {},
        rect: () => {},
        clip: () => {},
      };
    }
    return null;
  };
}

// Mock URL.createObjectURL for JSDOM
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = function(blob) {
    return 'blob:mock-url-' + Math.random().toString(36).substr(2, 9);
  };
}

if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = function() {};
}

// Mock Image for JSDOM to auto-trigger onload
if (typeof Image !== 'undefined') {
  const OriginalImage = Image;
  global.Image = class extends OriginalImage {
    constructor(width, height) {
      super(width, height);
      // Set default dimensions
      this.width = width || 100;
      this.height = height || 100;
    }

    set src(value) {
      // Trigger onload asynchronously when src is set
      setTimeout(() => {
        if (this.onload) {
          this.onload();
        }
      }, 0);
      // Call the original setter if it exists
      if (Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')) {
        Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set.call(this, value);
      }
    }

    get src() {
      return this._src || '';
    }
  };
}
