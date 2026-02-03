export const locales = {
    en: {
        app: { tagline: "Sync Your Bar", subline: "Instant order management" },
        settings: { title: "Settings", theme: "Theme", lang: "Language", reset: "Reset App Data" },
        setup: {
            host: "Host Session", join: "Join Session", resume: "Resume",
            join_title: "Enter Code", lobby: "Lobby",
            label_name: "Display Name", select_role: "Select your role",
            scan_hint: "Scan QR", no_peers: "Waiting for peers...",
            join_hint: "Enter the 6-character code from the host.",
            connecting: "Connecting…",
            resuming: "Resuming saved session…",
            waiting_peers: "Waiting for devices…",
            peers_connected: "{count} connected",
            connected_short: "Online",
            waiting_short: "Waiting",
            share_title: "Join my Kafić.hr session"
        },
        roles: { waiter: "Waiter", bartender: "Bartender" },
        waiter: {
            select_table: "Select Table", table_short: "Tbl",
            current_order: "Current Order", empty: "No items",
            empty_order: "Order is empty",
            tables: "Tables",
            menu_root: "Menu"
        },
        bartender: { incoming: "Incoming", all_done: "All caught up", table_label: "Table {table}" },
        actions: {
            save: "Save & Close", connect: "Connect", copy_link: "Copy Link",
            send: "Send Order", clear: "Clear", mark_done: "Done",
            add: "Add", install: "Install", remove: "Remove",
            cancel: "Cancel", confirm: "Confirm", back: "Back"
        },
        alerts: {
            order_sent: "Order Sent", network_error: "Not Connected",
            paste_failed: "Paste failed", scan_unsupported: "Scanner not supported",
            scan_success: "QR code scanned",
            join_invalid: "Enter a 6-character code",
            offline: "You are offline",
            back_online: "Back online",
            install_complete: "App installed",
            installing: "Installing…",
            link_copied: "Link copied",
            share_failed: "Share failed",
            peer_joined: "Device joined",
            peer_left: "Device left",
            no_session: "No session found",
            no_peers: "No peers connected",
            new_order: "New order for table {table}",
            sw_failed: "Service worker failed",
            updated: "Update ready",
            item_added: "{qty}x {item} added",
            code_copied: "Ready to paste..."
        },
        confirm: { title: "Confirm", clear: "Clear entire order?", leave_session: "Leave this session?" },
        manager: {
            title: "Manager",
            table_count: "Total Tables",
            menu_structure: "Menu Structure",
            add_item: "Add Item",
            add_subitem: "Add Sub-item",
            upload_image: "Upload Image",
            change_image: "Change Image",
            remove_image: "Remove Image",
            price_placeholder: "Price...",
            label_placeholder: "Item Label",
            delete_item: "Delete",
            missing_label: "Missing label"
        },
        welcome: {
            title: "Quick start",
            step1: "Host a session to create a 6-letter code.",
            step2: "Join from another device or scan the QR.",
            step3: "Pick Waiter or Bartender and start serving.",
            step4: "Tip: Works offline once connected."
        },
        footer: {
            privacy: "100% private and open source",
            credit: "Developed by Matija Radeljak"
        }
    },
    hr: {
        app: { tagline: "Kafić.hr", subline: "Sinkronizacija narudžbi" },
        settings: { title: "Postavke", theme: "Tema", lang: "Jezik", reset: "Resetiraj aplikaciju" },
        setup: {
            host: "Nova Sesija", join: "Pridruži se", resume: "Nastavi",
            join_title: "Unesi Kod", lobby: "Predvorje",
            label_name: "Vaše Ime", select_role: "Odaberi ulogu",
            scan_hint: "Skeniraj QR", no_peers: "Čekam uređaje...",
            join_hint: "Upiši 6-znamenkasti kod od hosta.",
            connecting: "Spajam se…",
            resuming: "Nastavljam spremljenu sesiju…",
            waiting_peers: "Čekam uređaje…",
            peers_connected: "{count} povezanih",
            connected_short: "Online",
            waiting_short: "Čekam",
            share_title: "Dodaj uređaj"
        },
        roles: { waiter: "Konobar", bartender: "Šanker" },
        waiter: {
            select_table: "Odaberi stol", table_short: "Stol",
            current_order: "Narudžba", empty: "Prazno",
            empty_order: "Narudžba je prazna",
            tables: "Stolovi",
            menu_root: "Meni"
        },
        bartender: { incoming: "Narudžbe", all_done: "Sve riješeno", table_label: "Stol {table}" },
        actions: {
            save: "Spremi", connect: "Poveži", copy_link: "Kopiraj link",
            send: "Pošalji", clear: "Očisti", mark_done: "Riješeno",
            add: "Dodaj", install: "Instaliraj", remove: "Ukloni",
            cancel: "Odustani", confirm: "Potvrdi", back: "Natrag"
        },
        alerts: {
            order_sent: "Poslano", network_error: "Nema veze",
            paste_failed: "Greška kod ljepljenja", scan_unsupported: "Kamera nije podržana",
            scan_success: "QR kod je skeniran",
            join_invalid: "Unesi 6 znakova",
            offline: "Nisi spojen na mrežu",
            back_online: "Ponovno si online",
            install_complete: "Aplikacija instalirana",
            installing: "Instaliram…",
            link_copied: "Link kopiran",
            share_failed: "Dijeljenje nije uspjelo",
            peer_joined: "Uređaj se spojio",
            peer_left: "Uređaj se odspojio",
            no_session: "Sesija nije pronađena",
            no_peers: "Nema spojenih uređaja",
            new_order: "Nova narudžba za stol {table}",
            sw_failed: "Service worker greška",
            updated: "Imamo novu verziju",
            item_added: "{qty}x {item} dodano",
            code_copied: "Link kopiran"
        },
        confirm: { title: "Potvrda", clear: "Obrisati cijelu narudžbu?", leave_session: "Izaći iz sesije?" },
        manager: {
            title: "Uređivanje",
            table_count: "Ukupno stolova",
            menu_structure: "Struktura Menija",
            add_item: "Dodaj stavku",
            add_subitem: "Dodaj pod-stavku",
            upload_image: "Dodaj sliku",
            change_image: "Promijeni sliku",
            remove_image: "Makni sliku",
            price_placeholder: "Cijena...",
            label_placeholder: "Naziv stavke",
            delete_item: "Obriši",
            missing_label: "Nedostaje naziv"
        },
        welcome: {
            title: "Brzi početak",
            step1: "Pokreni sesiju i dobit ćeš 6-znamenkasti kod.",
            step2: "Pridruži se s drugog uređaja ili skeniraj QR.",
            step3: "Odaberi Konobar ili Šanker i kreni s radom.",
            step4: "Savjet: Radi i offline nakon spajanja."
        },
        footer: {
            privacy: "100% privatno i open source",
            credit: "Razvio Matija Radeljak"
        }
    }
};
