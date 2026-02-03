# Kafić.hr

Kafić.hr is a Progressive Web App (PWA) designed to streamline order management in cafes and bars. It facilitates real-time, synchronized communication between waiters, bartenders, and managers, enabling efficient order processing and improved operational flow. Built as a modern web application, it leverages peer-to-peer technology to provide a robust and responsive experience, even in environments with unreliable internet connectivity.

## Features

*   **Real-time Order Sync:** Instantaneous transmission of orders from waiters to bartenders via a peer-to-peer network.
*   **Role-Based Interfaces:** Dedicated interfaces for Waiters (taking orders), Bartenders (fulfilling orders), and Managers (configuring the system).
*   **PWA Capabilities:** Installable on devices, offline access, and fast loading times through Service Worker caching.
*   **Dynamic Menu Management:** Managers can easily configure menu items, categories, prices, and even add images.
*   **Table Management:** Configurable number of tables for order assignment.
*   **Multi-language Support:** Currently supports Croatian and English, with an adaptable internationalization system.
*   **Theme Switching:** Users can toggle between light and dark themes.
*   **QR/Barcode Session Joining:** Easily join a session by scanning a QR code or entering a session code.
*   **Local State Persistence:** User preferences and session details are saved locally.
*   **Audio Notifications:** Bartenders receive audio cues for new incoming orders.

## Technologies Used

*   **Front-end:** HTML5, CSS3, Vanilla JavaScript
*   **Real-time Communication:** [Trystero](https://www.npmjs.com/package/trystero) (a WebRTC-based peer-to-peer library)
*   **PWA Core:** Web App Manifest, Service Workers
*   **Styling:** Custom CSS, [Font Awesome](https://fontawesome.com/) for icons
*   **Internationalization:** Custom JavaScript module
*   **QR/Barcode Scanning:** Native `BarcodeDetector` API

## Getting Started

Kafić.hr is a client-side PWA and does not require a backend server for its core functionality, as it uses peer-to-peer communication. You only need a static file server to host the application files.

### Running Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/kafic-hr.git
    cd kafic-hr
    ```
    *(Note: The current project directory is `/home/kafi-ota/public_html`, so if you're working directly here, you can skip cloning.)*

2.  **Serve the files:**
    You can use any static file server to host the `public_html` directory.

    **Using Python's built-in HTTP server:**
    ```bash
    python -m http.server 8000
    ```
    Then, open your web browser and navigate to `http://localhost:8000`.

    **Using Node.js `serve` package (if you have Node.js installed):**
    First, install `serve` globally if you haven't already:
    ```bash
    npm install -g serve
    ```
    Then, from the `public_html` directory:
    ```bash
    serve .
    ```
    Open your web browser and navigate to the address provided by `serve` (e.g., `http://localhost:5000`).

### Installation (PWA)

Once the application is served, your browser should prompt you to install the PWA, or you can manually add it to your home screen/desktop via your browser's menu options.

## Usage

### Setting up a Session

1.  **Host a Session:** On the initial screen, click "Host Session". This will generate a unique 6-letter session code.
2.  **Share the Code:** Share this code with other devices (waiters, bartenders). They can join by entering the code or scanning the displayed QR code.

### Roles

*   **Waiter:** Select the "Waiter" role. You can then select a table, browse the menu, add items to an order, specify quantities, and send the order to the bartender.
*   **Bartender:** Select the "Bartender" role. You will receive incoming orders in real-time. Once an order is prepared, you can mark it as "Done".
*   **Manager:** The manager interface (accessible via a gear icon in the lobby or a specific entry point) allows configuration of the number of tables and management of the menu structure, including adding/editing items, categories, and images.

### Customization

*   **Theme:** Toggle between light and dark themes using the sun/moon icon.
*   **Language:** Switch between available languages (Croatian/English) using the language button.

## Project Structure (Core Directories)

```
.
├── css/              # Stylesheets, including Font Awesome and custom styles
├── images/           # Application icons, splash screens, and other static images
├── js/               # JavaScript modules (app logic, network, state, roles, i18n, etc.)
├── icon-192.png      # PWA icon (192x192)
├── icon-512.png      # PWA icon (512x512)
├── index.html        # Main application entry point
├── manifest.json     # PWA manifest file
├── sw.js             # Service Worker for offline capabilities and caching
└── GEMINI.md         # AI agent's analysis of the codebase
```

## Contributing

Currently, there are no formal contribution guidelines. If you are interested in contributing, please reach out to the repository maintainer.

## License

This project is not licensed for public use or distribution. Please refer to the `LICENSE` file for more details.
