export const locales = {
    en: {
        app: { tagline: "Kafić.hr", subline: "Real-time order management" },
        settings: { title: "Settings", theme: "Theme", lang: "Language", reset: "Factory Reset", handed: "Hand", left: "Left", right: "Right" , on: "ON" , off: "OFF" , solomode: "Solo mode"},
        setup: {
            host: "Start Session", join: "Join Session", resume: "Reconnect",
            join_title: "Enter Code", lobby: "Connection Hub",
            label_name: "Display Name", select_role: "Select Role",
            scan_hint: "Scan QR", no_peers: "Waiting for staff...",
            join_hint: "Enter the session code from the host device.",
            connecting: "Connecting...",
            resuming: "Restoring session...",
            waiting_peers: "Looking for devices...",
            peers_connected: "{count} active",
            connected_short: "Online",
            waiting_short: "Idle",
            share_title: "Invite Staff",
            lijevo: "L",
            desno: "R"
        },
        roles: { waiter: "Waiter", bartender: "Bartender" },
        waiter: {
            select_table: "Select Table", table_short: "Tbl",
            current_order: "Current Order", empty: "No items selected",
            empty_order: "Order is empty",
            tables: "Tables",
            menu_root: "Menu"
        },
        bartender: { incoming: "Queue", all_done: "No pending orders", table_label: "Tbl {table}" },
        actions: {
            save: "Save", connect: "Connect", copy_link: "Copy Link",
            send: "Send Order", clear: "Clear All", mark_done: "Complete",
            add: "Add", install: "Install App", remove: "Remove",
            cancel: "Cancel", confirm: "Confirm", back: "Back"
        },
        alerts: {
            order_sent: "Order Sent", network_error: "Connection Lost",
            paste_failed: "Could not paste", scan_unsupported: "Camera not supported",
            scan_success: "Code scanned",
            join_invalid: "Invalid code format",
            offline: "Device is offline",
            back_online: "Connection restored",
            install_complete: "Install successful",
            installing: "Installing...",
            link_copied: "Link copied to clipboard",
            share_failed: "Sharing unavailable",
            peer_joined: "Device connected",
            peer_left: "Device disconnected",
            no_session: "Session not found",
            no_peers: "No other devices connected",
            new_order: "New order: Table {table}",
            sw_failed: "System error (SW)",
            updated: "Update available",
            item_added: "{qty}x {item} added",
            code_copied: "Code copied"
        },
        confirm: { title: "Confirm Action", clear: "Discard this order?", leave_session: "Disconnect from session?" },
        manager: {
            title: "Menu Manager",
            table_count: "Table Count",
            menu_structure: "Menu Editor",
            add_item: "Add Item",
            add_subitem: "Add Sub-item",
            add_image: "Add Image",
            upload_image: "Upload New",
            change_image: "Replace",
            remove_image: "Remove",
            price_placeholder: "Price",
            label_placeholder: "Item Name",
            delete_item: "Delete Item",
            missing_label: "Name required"
        },
        welcome: {
            title: "Quick Start",
            step1: "Start a session on one device (Host).",
            step2: "Scan the QR code with other devices to join.",
            step3: "Assign roles (Waiter/Bartender) and start syncing.",
            step4: "Note: Works locally without internet."
        },
        footer: {
            privacy: "100% Private & Open Source",
            credit: "Created by Matija Radeljak",
            privpolicy: "Privacy policy"
        }
    },
    hr: {
        app: { tagline: "Kafić.hr", subline: "Usklađivanje narudžbi" },
        settings: { title: "Postavke", theme: "Tema", lang: "Jezik", reset: "Izbriši podatke", handed: "Ruka", left: "Lijeva", right: "Desna" , on: "DA" , off: "NE" , solomode: "Solo način"},
        setup: {
            host: "Pokreni smjenu", join: "Pridruži se", resume: "Nastavi",
            join_title: "Prijava", lobby: "Povezivanje",
            label_name: "Naziv", select_role: "Radno mjesto",
            scan_hint: "Skeniraj QR", no_peers: "Čekanje kolega...",
            join_hint: "Unesi kod s glavnog uređaja.",
            connecting: "Uspostava veze...",
            resuming: "Vraćanje sesije...",
            waiting_peers: "Tražim uređaje...",
            peers_connected: "{count} na vezi",
            connected_short: "Spojen",
            waiting_short: "Tražim",
            share_title: "Dodaj uređaj",
            lijevo: "L",
            desno: "D"
        },
        roles: { waiter: "Konobar", bartender: "Šank" },
        waiter: {
            select_table: "Odabir stola", table_short: "Stol",
            current_order: "Trenutni unos", empty: "Nema stavki",
            empty_order: "Prazna narudžba",
            tables: "Sala",
            menu_root: "Cjenik"
        },
        bartender: { incoming: "Nove narudžbe", all_done: "Sve isporučeno", table_label: "Stol {table}" },
        actions: {
            save: "Spremi", connect: "Spoji se", copy_link: "Kopiraj",
            send: "Pošalji", clear: "Poništi", mark_done: "Gotovo",
            add: "Dodaj", install: "Instaliraj", remove: "Ukloni",
            cancel: "Odustani", confirm: "Potvrdi", back: "Natrag"
        },
        alerts: {
            order_sent: "Poslano na šank", network_error: "Veza prekinuta",
            paste_failed: "Greška u međuspremniku", scan_unsupported: "Kamera nije dostupna",
            scan_success: "Kod učitan",
            join_invalid: "Neispravan kod",
            offline: "Nema interneta",
            back_online: "Veza uspostavljena",
            install_complete: "Instalacija gotova",
            installing: "Preuzimanje...",
            link_copied: "Link kopiran",
            share_failed: "Dijeljenje neuspješno",
            peer_joined: "Novi uređaj spojen",
            peer_left: "Uređaj odspojen",
            no_session: "Sesija ne postoji",
            no_peers: "Nema drugih uređaja",
            new_order: "Narudžba: Stol {table}",
            sw_failed: "Sistemska greška",
            updated: "Dostupna nadogradnja",
            item_added: "Dodan {item} ({qty}x)",
            code_copied: "Kod kopiran"
        },
        confirm: { title: "Potvrda", clear: "Obrisati cijelu narudžbu?", leave_session: "Prekinuti radnu sesiju?" },
        manager: {
            title: "Uređivanje",
            table_count: "Broj stolova",
            menu_structure: "Uređivanje ponude",
            add_item: "Nova stavka",
            add_subitem: "Nova pod-stavka",
            add_image: "Dodaj sliku",
            upload_image: "Učitaj sliku",
            change_image: "Promijeni",
            remove_image: "Ukloni",
            price_placeholder: "Cijena",
            label_placeholder: "Naziv",
            delete_item: "Obriši stavku",
            missing_label: "Nedostaje naziv"
        },
        welcome: {
            title: "Upute",
            step1: "Jedan uređaj započinje smjenu (Host).",
            step2: "Ostali se pridružuju skeniranjem koda.",
            step3: "Odaberite uloge i započnite rad.",
            step4: "Aplikacija radi i bez interneta (lokalno)."
        },
        footer: {
            privacy: "Privatno i otvorenog koda",
            credit: "Aning Film d.o.o.",
            privpolicy: "Politika privatnosti"
        }
    }
};