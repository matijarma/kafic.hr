# Project Overview: Kafić.hr

Kafić.hr is a Progressive Web App (PWA) designed for real-time order management within cafes or bars. It enables synchronized order handling between different staff roles, specifically waiters, bartenders, and managers. The application leverages peer-to-peer (P2P) communication, powered by the Trystero WebRTC library, to facilitate instant updates and collaboration.

Built with vanilla JavaScript, HTML, and CSS, Kafić.hr utilizes modern browser features such as Service Workers for offline functionality and `localStorage` for state persistence. Key features include internationalization (with support for Croatian and English), dynamic menu and table management interfaces, and QR/barcode scanning for session joining.

## Technologies Used

*   **Front-end:** HTML, CSS (with Font Awesome for iconography), Vanilla JavaScript
*   **PWA Features:** Web App Manifest, Service Worker (for asset caching and offline access)
*   **Real-time Communication:** Trystero (a WebRTC-based P2P library)
*   **State Management:** Custom global JavaScript `state` object, augmented by `localStorage` for persistent data.
*   **Internationalization:** Custom `i18n` module for multi-language support.
*   **QR/Barcode Scanning:** Native `BarcodeDetector` API.
*   **Local Storage:** Used for persisting user preferences (name, theme, language) and session data.
*   **Styling:** Custom `style.css` and integrated Font Awesome library.

## Architecture Highlights

The application follows a modular JavaScript structure, with distinct files for different functionalities (e.g., `network.js`, `state.js`, `waiter.js`, `bartender.js`, `manager.js`, `i18n.js`, `ux.js`, `data.js`, `db.js`, `qr.js`, `session.js`).
`index.html` serves as the main entry point, dynamically loading CSS and JS modules via an import map. The UI is structured around different "views" (`setup`, `waiter`, `bartender`, `manager`), managed by `js/app.js`.

P2P communication via Trystero allows devices to connect directly, enabling efficient and real-time synchronization of orders and session data without a centralized server. The Service Worker ensures the application can function reliably offline and provides fast loading times by caching essential assets.

## Building and Running

This project does not utilize a traditional build system (e.g., Webpack, Parcel) or a package manager (e.g., npm, Yarn). It is designed to be served directly as static files.

### Running the Application

To run Kafić.hr, you simply need to serve the contents of the current directory (`public_html`) using any static file server.

**Example using Python's built-in HTTP server:**

```bash
python -m http.server 8000
```

Then, open your web browser and navigate to `http://localhost:8000`.

**Example using Node.js `serve` package (if installed globally):**

```bash
serve .
```

Then, open your web browser and navigate to the address provided by `serve` (e.g., `http://localhost:5000`).

### Testing

No explicit testing framework or testing scripts were identified within the codebase. Verification would typically involve manual testing of features across different roles and network conditions.

## Development Conventions

*   **Vanilla JavaScript:** The codebase primarily uses plain JavaScript for all logic and DOM manipulation.
*   **Modular Design:** Code is organized into small, focused modules (`.js` files) to enhance maintainability.
*   **Direct DOM Manipulation:** UI elements are rendered and updated directly by manipulating the Document Object Model.
*   **Internationalization:** Text content for the UI is managed using `data-i18n` attributes and a custom `i18n` module.
*   **Theming:** The application supports light and dark modes, controlled by a `data-theme` attribute on the `<html>` element and persisted in `localStorage`.
*   **Cache Busting:** A version number (`__APP_VERSION__`) is used to manage service worker and static asset caching effectively.
*   **Local Storage:** Critical user preferences and session state are stored and retrieved using the browser's `localStorage` API.
