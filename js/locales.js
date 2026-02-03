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
            empty_order: "Order is empty"
        },
        bartender: { incoming: "Incoming", all_done: "All caught up" },
        actions: {
            save: "Save & Close", connect: "Connect", copy_link: "Copy Link",
            send: "Send Order", clear: "Clear", mark_done: "Done",
            add: "Add", install: "Install"
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
        confirm: { clear: "Clear entire order?", leave_session: "Leave this session?" },
        manager: {
            title: "Manager",
            table_count: "Total Tables",
            menu_structure: "Menu Structure",
            add_item: "Add Item",
            upload_image: "Upload Image",
            remove_image: "Remove Image",
            price_placeholder: "Price...",
            label_placeholder: "Item Label",
            delete_item: "Delete"
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
            empty_order: "Narudžba je prazna"
        },
        bartender: { incoming: "Narudžbe", all_done: "Sve riješeno" },
        actions: {
            save: "Spremi", connect: "Poveži", copy_link: "Kopiraj link",
            send: "Pošalji", clear: "Očisti", mark_done: "Riješeno",
            add: "Dodaj", install: "Instaliraj"
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
        confirm: { clear: "Obrisati cijelu narudžbu?", leave_session: "Izaći iz sesije?" },
        manager: {
            title: "Uređivanje",
            table_count: "Ukupno stolova",
            menu_structure: "Struktura Menija",
            add_item: "Dodaj stavku",
            upload_image: "Dodaj sliku",
            remove_image: "Makni sliku",
            price_placeholder: "Cijena...",
            label_placeholder: "Naziv stavke",
            delete_item: "Obriši"
        }
    }
};
