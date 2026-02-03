# ☕ Kafić.hr — Real-time P2P Order Management

Kafić.hr is a modern, serverless Progressive Web App (PWA) designed to synchronize order management between waiters and bartenders in real-time. 🚀

🔗 **Live App:** [https://kafić.hr](https://kafić.hr)  
📂 **Source Code:** [https://github.com/matijarma/kafic.hr](https://github.com/matijarma/kafic.hr)

---

## ✨ Features

*   **⚡ Instant P2P Sync:** No central database or backend. Devices talk directly to each other using WebRTC.
*   **📡 Offline-First:** Works offline thanks to Service Workers. Orders are synced as soon as a connection is established.
*   **🎭 Multi-Role Support:** Dedicated interfaces for Waiters, Bartenders, and Managers.
*   **🛠️ Fully Customizable:** Manage your own menu structure, prices, and table layout directly in the app.
*   **📱 PWA Ready:** Install it on your phone or tablet for a native app feel.
*   **🌍 Multilingual:** Support for Croatian and English out of the box.
*   **🌓 Dark Mode:** Easy on the eyes for those late-night shifts.

---

## 🛠️ How It Works (The Magic 🪄)

Kafić.hr is unique because it **doesn't use a central server** to store or pass orders. Instead, it creates a private "mesh" network between devices in the same cafe.

1.  **Session Hosting:** A manager or "main" device hosts a session, which generates a unique 6-character code. 🔑
2.  **Joining:** Waiters and bartenders join using that code (or by scanning a QR code). 🤳
3.  **P2P Communication:** Using **Trystero (WebRTC)**, every device becomes a peer. When a waiter sends an order, it is broadcasted directly to the bartenders' devices.
4.  **Zero Maintenance:** No accounts, no subscriptions, and no server maintenance. Data is stored locally in your browser (`localStorage` and `IndexedDB`).

---

## 🚀 App Flow

### 1. Setup 🏠
*   Enter your name and choose whether to **Host** a new session or **Join** an existing one.
*   Share the join code or the QR code with your team.

### 2. Waiter Workflow ☕
*   Select a **Table**.
*   Browse the custom **Menu** categories.
*   Add items with specific quantities to the **Current Order**.
*   Hit **Send Order** — it instantly pops up on the bartender's screen with a notification sound.

### 3. Bartender Workflow 🍸
*   See a live feed of **Incoming Orders** sorted by time.
*   Each card shows the table number, items, and elapsed time.
*   Tap **Mark Done** to clear the order once it's served.

### 4. Manager Workflow ⚙️
*   Adjust the **Table Count** (using a smart slider that respects grid layouts).
*   Build your **Menu Tree**: add categories, sub-items, prices, and even upload photos for items.

---

## 🏗️ Technical Stack

*   **Language:** Pure Vanilla JavaScript (ES Modules).
*   **Networking:** [Trystero](https://github.com/dmotz/trystero) for WebRTC abstraction.
*   **Storage:** `localStorage` for state & `IndexedDB` for menu images.
*   **Icons:** Font Awesome 6.
*   **Manifest:** Full PWA support with `sw.js` for asset caching.

---

## 📄 License

This project is released under the **nolicense** license. See the `LICENSE` file for details.

---
*Built with ❤️ for better hospitality.*