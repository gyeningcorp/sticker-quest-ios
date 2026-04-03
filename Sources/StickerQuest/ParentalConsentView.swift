import SwiftUI

struct ParentalConsentView: View {
    @AppStorage("hasAcceptedConsent") private var hasAcceptedConsent = false
    @State private var isChecked = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "FF6B9D"), Color(hex: "845EC2")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("A note for Grown-Ups")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 40)

                    VStack(alignment: .leading, spacing: 12) {
                        bulletItem("No ads — ever")
                        bulletItem("No data collection beyond progress sync")
                        bulletItem("No tracking of any kind")
                        bulletItem("Fully COPPA compliant")
                    }
                    .padding()
                    .background(Color.white.opacity(0.15))
                    .cornerRadius(16)

                    Button(action: { isChecked.toggle() }) {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                                .font(.title2)
                                .foregroundColor(.white)
                            Text("I am the parent or guardian of the child who will use this app")
                                .foregroundColor(.white)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    .padding(.top, 8)

                    Button(action: {
                        hasAcceptedConsent = true
                    }) {
                        Text("Continue")
                            .fontWeight(.semibold)
                            .foregroundColor(isChecked ? Color(hex: "845EC2") : .white.opacity(0.5))
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(isChecked ? Color.white : Color.white.opacity(0.2))
                            .cornerRadius(14)
                    }
                    .disabled(!isChecked)

                    Link("Privacy Policy",
                         destination: URL(string: "https://gyeningcorp.github.io/sticker-quest-ios/privacy.html")!)
                        .font(.footnote)
                        .foregroundColor(.white.opacity(0.8))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 4)
                }
                .padding(.horizontal, 24)
            }
        }
    }

    private func bulletItem(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("•")
                .foregroundColor(.white)
                .fontWeight(.bold)
            Text(text)
                .foregroundColor(.white)
        }
    }
}
