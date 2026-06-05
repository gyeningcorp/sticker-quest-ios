import SwiftUI

struct LoginView: View {
    @AppStorage("isLoggedIn") private var isLoggedIn = false
    @AppStorage("userIdentifier") private var userIdentifier = ""
    @AppStorage("usingAppleAccount") private var usingAppleAccount = false
    @State private var bounce = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(hex: "FF6B9D"), Color(hex: "845EC2")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Soft decorative bubbles
            GeometryReader { geo in
                Circle().fill(Color.white.opacity(0.08))
                    .frame(width: 220, height: 220)
                    .position(x: geo.size.width * 0.85, y: geo.size.height * 0.15)
                Circle().fill(Color.white.opacity(0.06))
                    .frame(width: 160, height: 160)
                    .position(x: geo.size.width * 0.1, y: geo.size.height * 0.8)
            }
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                Text("⭐")
                    .font(.system(size: 88))
                    .offset(y: bounce ? -10 : 0)
                    .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: bounce)
                    .onAppear { bounce = true }

                Text("Sticker Quest")
                    .font(.system(size: 38, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .padding(.top, 12)

                Text("Chores + Behavior = Rewards!")
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.92))
                    .padding(.top, 4)

                Spacer()

                VStack(spacing: 14) {
                    // Start instantly — no account needed (Kids-friendly, local-only)
                    Button(action: startLocal) {
                        HStack(spacing: 10) {
                            Text("🚀")
                            Text("Start Playing")
                                .font(.system(size: 20, weight: .bold, design: .rounded))
                        }
                        .foregroundColor(Color(hex: "845EC2"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(Color.white)
                        .cornerRadius(18)
                        .shadow(color: .black.opacity(0.18), radius: 12, y: 6)
                    }

                    Text("No account needed to play.\nUse an export code to sync across devices.")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .multilineTextAlignment(.center)
                        .foregroundColor(.white.opacity(0.8))
                        .padding(.top, 4)
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 50)
            }
        }
    }

    // Local-only mode: no personal data, works fully offline.
    private func startLocal() {
        userIdentifier = ""
        usingAppleAccount = false
        withAnimation { isLoggedIn = true }
    }
}

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgb: UInt64 = 0
        scanner.scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255.0,
            green: Double((rgb >> 8) & 0xFF) / 255.0,
            blue: Double(rgb & 0xFF) / 255.0
        )
    }
}
