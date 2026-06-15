# Vendored runtimes

`opencv.js` — official OpenCV 4.x WebAssembly build (from https://docs.opencv.org/4.x/opencv.js),
hosted locally so Lane Keeping detection loads reliably (no CDN dependency, works offline).
Loaded lazily by `src/lib/detection/opencvLoader.ts` only when lane detection is activated.
