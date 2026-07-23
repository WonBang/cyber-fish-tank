import Cocoa
import WebKit

// Menubar menu follows the system language; the web UI reads localStorage "cft.lang".
let isKorean = Locale.preferredLanguages.first?.lowercased().hasPrefix("ko") ?? false
func loc(_ ko: String, _ en: String) -> String { isKorean ? ko : en }

final class AppDelegate: NSObject, NSApplicationDelegate, NSPopoverDelegate, NSWindowDelegate {
    var statusItem: NSStatusItem!
    var popover: NSPopover!
    var webView: WKWebView!
    var detachedWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem.button {
            if let icon = NSImage(systemSymbolName: "fish.fill", accessibilityDescription: "Cyber Fish Tank") {
                icon.isTemplate = true
                button.image = icon
            } else {
                button.title = "🐟"
            }
            button.action = #selector(statusItemClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
            button.target = self
        }

        let config = WKWebViewConfiguration()
        #if DEBUG
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        #endif
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 640, height: 480), configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        loadTank()

        let contentVC = NSViewController()
        contentVC.view = webView

        popover = NSPopover()
        popover.contentViewController = contentVC
        popover.contentSize = NSSize(width: 640, height: 480)
        popover.behavior = .transient
        popover.delegate = self
        popover.appearance = NSAppearance(named: .darkAqua)

        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53, let popover = self?.popover, popover.isShown {
                popover.performClose(nil)
                return nil
            }
            return event
        }
    }

    func loadTank() {
        let htmlURL = tankHTMLURL()
        // #compact switches index.html into the compact drawer layout
        let compactURL = URL(string: htmlURL.absoluteString + "#compact") ?? htmlURL
        webView.loadFileURL(compactURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
    }

    func tankHTMLURL() -> URL {
        // App bundle Resources first, then repo checkout (dev mode)
        if let bundled = Bundle.main.url(forResource: "index", withExtension: "html") {
            return bundled
        }
        let devPath = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // macos/
            .deletingLastPathComponent()   // repo root
            .appendingPathComponent("index.html")
        return devPath
    }

    @objc func statusItemClicked(_ sender: NSStatusBarButton) {
        let event = NSApp.currentEvent
        if event?.type == .rightMouseUp {
            showMenu()
            return
        }
        if popover.isShown {
            popover.performClose(nil)
        } else if let window = detachedWindow, window.isVisible {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        } else {
            popover.show(relativeTo: sender.bounds, of: sender, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
        }
    }

    func showMenu() {
        // read the web UI's current language first so the submenu can check it
        let js = "localStorage.getItem('cft.lang') || ((navigator.language || '').toLowerCase().indexOf('ko') === 0 ? 'ko' : 'en')"
        webView.evaluateJavaScript(js) { [weak self] result, _ in
            self?.presentMenu(currentLang: result as? String ?? (isKorean ? "ko" : "en"))
        }
    }

    func presentMenu(currentLang: String) {
        let menu = NSMenu()
        menu.addItem(withTitle: loc("창으로 분리", "Detach to Window"), action: #selector(detachToWindow), keyEquivalent: "d").target = self
        menu.addItem(withTitle: loc("새로고침", "Reload"), action: #selector(reloadTank), keyEquivalent: "r").target = self
        menu.addItem(.separator())

        let langMenu = NSMenu()
        let koItem = NSMenuItem(title: "한국어", action: #selector(selectLanguage(_:)), keyEquivalent: "")
        koItem.target = self
        koItem.representedObject = "ko"
        koItem.state = currentLang == "ko" ? .on : .off
        let enItem = NSMenuItem(title: "English", action: #selector(selectLanguage(_:)), keyEquivalent: "")
        enItem.target = self
        enItem.representedObject = "en"
        enItem.state = currentLang == "en" ? .on : .off
        langMenu.addItem(koItem)
        langMenu.addItem(enItem)
        let langRoot = NSMenuItem(title: loc("언어", "Language"), action: nil, keyEquivalent: "")
        langRoot.submenu = langMenu
        menu.addItem(langRoot)

        menu.addItem(.separator())
        menu.addItem(withTitle: loc("종료", "Quit"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    @objc func reloadTank() {
        loadTank()
    }

    // Set the web UI language: same localStorage key + reload the in-page toggle uses
    @objc func selectLanguage(_ sender: NSMenuItem) {
        guard let lang = sender.representedObject as? String else { return }
        let js = "localStorage.setItem('cft.lang', '\(lang)'); location.reload();"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    @objc func detachToWindow() {
        popover.performClose(nil)
        if detachedWindow == nil {
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 720, height: 540),
                styleMask: [.titled, .closable, .resizable],
                backing: .buffered, defer: false)
            window.title = loc("픽셀어항", "Pixel Aquarium")
            window.appearance = NSAppearance(named: .darkAqua)
            window.level = .floating
            window.isReleasedWhenClosed = false
            window.delegate = self
            if !window.setFrameUsingName("CyberFishTankWindow") {
                window.center()
            }
            window.setFrameAutosaveName("CyberFishTankWindow")
            detachedWindow = window
        }
        // Move the shared webView into the window so tank state continues seamlessly
        popover.contentViewController?.view = NSView()
        detachedWindow?.contentView = webView
        detachedWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func popoverShouldDetach(_ popover: NSPopover) -> Bool { true }

    // detached window closed: hand the shared webView back to the popover
    func windowWillClose(_ notification: Notification) {
        detachedWindow?.contentView = NSView()
        popover.contentViewController?.view = webView
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
