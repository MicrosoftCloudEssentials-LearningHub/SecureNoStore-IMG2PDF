# Demo: Secure Image to PDF (No Store, No Login)

Atlanta, USA

[![GitHub](https://img.shields.io/badge/--181717?logo=github&logoColor=ffffff)](https://github.com/)
[brown9804](https://github.com/brown9804)

Last updated: 2026-03-25

----------

> Static demo app for GitHub Pages that lets users upload photos and convert them into black-and-white scan PDF documents entirely in the browser.

> [!NOTE]
> This demo is designed so image processing and PDF creation happen in the browser runtime. GitHub Pages only serves the static assets; it does not receive uploaded image data from the app.

<img width="2102" height="3088" alt="image" src="https://github.com/user-attachments/assets/2dcb56d7-6eb6-4556-886e-5699b288e0fa" />

<details>
<summary><b> Detailed example </b> (Click to expand)</summary>

<img width="2896" height="4963" alt="image" src="https://github.com/user-attachments/assets/1f00ea36-188a-44b0-902f-32c96e58f85c" />

</details>

## What it does

- Accepts one or more local image files.
- Lets users switch between original images and a black-and-white scan look.
- Applies a black-and-white scan look with brightness, contrast, grain, and vignette controls when enabled.
- Exports a multi-page PDF in the browser.
- Keeps images on-device with no login and no server-side upload flow.

> [!IMPORTANT]
> The app is plain HTML, CSS, and JavaScript. There is no backend and no build step required, so it can be published directly from this repository using GitHub Pages.

## Supported image formats

> The app accepts standard browser-readable images such as JPG, JPEG, PNG, GIF, BMP, WebP, AVIF, and SVG. It also includes in-browser fallback conversion for:

- HEIC and HEIF, converted locally to PNG before preview/export
- TIFF and TIF, decoded locally to PNG before preview/export

Format support still depends on the browser runtime for some edge cases. The app will skip files it cannot decode and report that in the status area instead of failing the whole batch. 

## Files

- `index.html` contains the app shell and CDN script include for jsPDF.
- `styles.css` contains the layout and visual design.
- `app.js` handles image loading, scan effects, page reordering, and PDF export.

## Local preview

- Open `index.html` in a browser, or serve the repository with any static file server. Example with Python:

    ```bash
    python3 -m http.server 8080
    ```

- Then open `http://localhost:8080`.

> [!NOTE]
> The repository also includes synthetic fixtures in [test-fixtures/images](test-fixtures/images) covering PNG, JPG, JPEG, GIF, BMP, TIFF, TIF, AVIF, HEIC, HEIF, and SVG for local testing.

## Publish to GitHub Pages

1. Push this repository to GitHub.
2. In the repository settings, open Pages.
3. Set the source to GitHub Actions.
4. Save, then wait for Pages to publish the site.

<!-- START BADGE -->
<div align="center">
  <img src="https://img.shields.io/badge/Total%20views-1580-limegreen" alt="Total views">
  <p>Refresh Date: 2026-02-25</p>
</div>
<!-- END BADGE -->
