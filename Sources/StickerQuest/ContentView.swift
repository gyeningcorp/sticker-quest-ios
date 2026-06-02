import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    @Binding var isLoading: Bool
    var userIdentifier: String
    var usingAppleAccount: Bool

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Block all external network requests — Kids category requirement
        let blockRule = """
        [{"trigger":{"url-filter":".*","unless-top-url":["^file://"]},"action":{"type":"block"}}]
        """
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "BlockExternal", encodedContentRuleList: blockRule) { ruleList, _ in
            if let ruleList = ruleList {
                config.userContentController.add(ruleList)
            }
        }
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Allow local file access for bundled content
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")

        // Inject native flags BEFORE any page script runs, so the web app sees the
        // correct mode at DOMContentLoaded (avoids a race where it briefly thinks
        // it's a standalone web page and shows the web login screen).
        let userId = userIdentifier
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let bootstrap = """
        window.SQ_NATIVE_APP = true;
        window.SQ_USING_APPLE = \(usingAppleAccount ? "true" : "false");
        window.STICKER_QUEST_USER_ID = "\(userId)";
        """
        let startScript = WKUserScript(source: bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        config.userContentController.addUserScript(startScript)

        // Native bridge: lets the web app talk back to Swift (e.g. Sign Out).
        config.userContentController.add(context.coordinator, name: "sqNative")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 1.0, green: 0.42, blue: 0.62, alpha: 1)
        webView.scrollView.bounces = true

        let refresh = UIRefreshControl()
        refresh.tintColor = .white
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.handleRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        // Load from local bundle — no external network required
        if let webContentURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebContent") {
            let directoryURL = webContentURL.deletingLastPathComponent()
            webView.loadFileURL(webContentURL, allowingReadAccessTo: directoryURL)
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: WebView
        init(_ parent: WebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
            webView.scrollView.refreshControl?.endRefreshing()
            // Native flags are already set at document start; just notify the app if it cares.
            webView.evaluateJavaScript("if (window.onNativeReady) { try { window.onNativeReady(); } catch(e) {} }", completionHandler: nil)
        }
        @objc func handleRefresh(_ sender: UIRefreshControl) {
            (sender.superview?.superview as? WKWebView)?.reload()
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
        }
        // Block all external navigation — kids app must stay local
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url {
                if url.isFileURL {
                    decisionHandler(.allow)
                } else {
                    decisionHandler(.cancel)
                }
            } else {
                decisionHandler(.allow)
            }
        }

        // Messages posted from the web app via window.webkit.messageHandlers.sqNative.postMessage(...)
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "sqNative" else { return }
            let action = (message.body as? String)
                ?? ((message.body as? [String: Any])?["action"] as? String)
            switch action {
            case "signOut":
                // Clear account state and return to the login screen.
                UserDefaults.standard.set(false, forKey: "isLoggedIn")
                UserDefaults.standard.set(false, forKey: "usingAppleAccount")
                UserDefaults.standard.removeObject(forKey: "userIdentifier")
                UserDefaults.standard.removeObject(forKey: "userName")
                UserDefaults.standard.removeObject(forKey: "userEmail")
            default:
                break
            }
        }
    }
}

struct ContentView: View {
    @AppStorage("userIdentifier") private var userIdentifier = ""
    @AppStorage("usingAppleAccount") private var usingAppleAccount = false
    @State private var isLoading = true

    var body: some View {
        ZStack {
            Color(red: 1.0, green: 0.42, blue: 0.62).ignoresSafeArea()
            WebView(isLoading: $isLoading, userIdentifier: userIdentifier, usingAppleAccount: usingAppleAccount)
                .ignoresSafeArea()
            if isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.5)
            }
        }
    }
}
