import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    @Binding var isLoading: Bool
    var userIdentifier: String

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // Allow local file access for bundled content
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
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

    class Coordinator: NSObject, WKNavigationDelegate {
        var parent: WebView
        init(_ parent: WebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
            webView.scrollView.refreshControl?.endRefreshing()
            // Inject user ID for backend sync
            let userId = parent.userIdentifier.replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
            webView.evaluateJavaScript("window.STICKER_QUEST_USER_ID = \"\(userId)\";", completionHandler: nil)
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
                // Allow local file:// URLs only
                if url.isFileURL {
                    decisionHandler(.allow)
                } else {
                    // Block all external URLs — required for Kids category
                    decisionHandler(.cancel)
                }
            } else {
                decisionHandler(.allow)
            }
        }
    }
}

struct ContentView: View {
    @AppStorage("userIdentifier") private var userIdentifier = ""
    @State private var isLoading = true

    var body: some View {
        ZStack {
            Color(red: 1.0, green: 0.42, blue: 0.62).ignoresSafeArea()
            WebView(isLoading: $isLoading, userIdentifier: userIdentifier)
                .ignoresSafeArea()
            if isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.5)
            }
        }
    }
}
