# Test Fixtures

Synthetic image fixtures for local development and unit testing.

Files in `images/` are intentionally generic and contain no real user data.

Included fixtures:
- `receipt-fixture.svg`: tall receipt-style document
- `form-fixture.svg`: portrait form layout
- `whiteboard-fixture.svg`: landscape note/whiteboard layout
- `note-fixture.svg`: square note-style image

Generated raster variants exist for each fixture in these formats:
- PNG
- JPG and JPEG
- GIF
- BMP
- TIFF and TIF
- AVIF
- HEIC and HEIF

WebP is supported by the app through native browser decoding, but a WebP fixture is not checked into this repository because the local macOS conversion tool available in this workspace does not emit WebP files.
