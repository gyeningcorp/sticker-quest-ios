import SwiftUI

@main
struct StickerQuestApp: App {
    @AppStorage("hasAcceptedConsent") private var hasAcceptedConsent = false
    @AppStorage("isLoggedIn") private var isLoggedIn = false

    var body: some Scene {
        WindowGroup {
            if !hasAcceptedConsent {
                ParentalConsentView()
            } else if !isLoggedIn {
                LoginView()
            } else {
                ContentView()
            }
        }
    }
}
