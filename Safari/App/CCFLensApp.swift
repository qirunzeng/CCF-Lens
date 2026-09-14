import AppKit
import SafariServices
import SwiftUI

@main
struct CCFLensApp: App {
    var body: some Scene {
        WindowGroup {
            SetupView()
                .frame(width: 480, height: 310)
        }
        .windowResizability(.contentSize)
    }
}

private struct SetupView: View {
    @State private var message = "启用后，CCF Lens 会在 ACM、IEEE Xplore 和 DBLP 的刊物名称旁显示 CCF 等级。"

    var body: some View {
        VStack(spacing: 20) {
            Image(nsImage: NSImage(named: NSImage.applicationIconName) ?? NSImage())
                .resizable()
                .scaledToFit()
                .frame(width: 72, height: 72)

            Text("CCF Lens")
                .font(.system(size: 30, weight: .bold, design: .rounded))

            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 390)

            Button("在 Safari 中启用") {
                SFSafariApplication.showPreferencesForExtension(
                    withIdentifier: "com.qirunzeng.CCFLens.Extension"
                ) { error in
                    DispatchQueue.main.async {
                        message = error?.localizedDescription ?? "Safari 扩展设置已打开。"
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(36)
    }
}
