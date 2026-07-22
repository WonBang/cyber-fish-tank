import Cocoa
import WebKit

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
        let menu = NSMenu()
        menu.addItem(withTitle: "창으로 분리", action: #selector(detachToWindow), keyEquivalent: "d")
        menu.addItem(withTitle: "새로고침", action: #selector(reloadTank), keyEquivalent: "r")
        menu.addItem(.separator())
        menu.addItem(withTitle: "종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    @objc func reloadTank() {
        loadTank()
    }

    @objc func detachToWindow() {
        popover.performClose(nil)
        if detachedWindow == nil {
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 720, height: 540),
                styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
                backing: .buffered, defer: false)
            window.title = "Cyber Fish Tank"
            window.titlebarAppearsTransparent = true
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
