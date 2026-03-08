import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var hasError: Bool

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 1.0, green: 0.42, blue: 0.62, alpha: 1)
        webView.scrollView.bounces = true
        let refresh = UIRefreshControl()
        refresh.tintColor = .white
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.handleRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate {
        var parent: WebView
        init(_ parent: WebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true; parent.hasError = false
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
            webView.scrollView.refreshControl?.endRefreshing()
        }
        @objc func handleRefresh(_ sender: UIRefreshControl) {
            (sender.superview?.superview as? WKWebView)?.reload()
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false; parent.hasError = true
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false; parent.hasError = true
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated,
               let host = navigationAction.request.url?.host,
               host != "gyeningcorp.github.io" && !host.contains("fonts.googleapis") {
                decisionHandler(.cancel); return
            }
            decisionHandler(.allow)
        }
    }
}

struct ContentView: View {
    @State private var isLoading = true
    @State private var hasError = false
    private let appURL = URL(string: "https://gyeningcorp.github.io/sticker-quest/")!

    var body: some View {
        ZStack {
            Color(red: 1.0, green: 0.42, blue: 0.62).ignoresSafeArea()
            WebView(url: appURL, isLoading: $isLoading, hasError: $hasError)
                .ignoresSafeArea()
                .opacity(hasError ? 0 : 1)
            if isLoading && !hasError {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    .scaleEffect(1.5)
            }
            if hasError {
                VStack(spacing: 20) {
                    Text("⭐").font(.system(size: 60))
                    Text("No Connection").font(.title2).fontWeight(.bold).foregroundColor(.white)
                    Text("Check your internet and try again.").font(.body).foregroundColor(.white.opacity(0.8)).multilineTextAlignment(.center)
                    Button(action: { hasError = false; isLoading = true }) {
                        Text("Try Again")
                            .font(.headline)
                            .foregroundColor(Color(red: 1.0, green: 0.42, blue: 0.62))
                            .padding(.horizontal, 32).padding(.vertical, 14)
                            .background(Color.white).cornerRadius(25)
                    }
                }.padding(40)
            }
        }
    }
}
