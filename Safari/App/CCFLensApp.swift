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
    private let extensionIdentifier = "com.qirunzeng.CCFLens.Extension"

    @State private var message = "启用后，CCF Lens 会在 Google Scholar、ACM、IEEE Xplore 和 DBLP 的刊物名称旁显示 CCF 等级。"
    @State private var isEnabled = false

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

            Button(isEnabled ? "在 Safari 中管理" : "在 Safari 中启用") {
                SFSafariApplication.showPreferencesForExtension(
                    withIdentifier: extensionIdentifier
                ) { error in
                    DispatchQueue.main.async {
                        if error == nil {
                            message = "Safari 扩展设置已打开。"
                        } else {
                            openSafariFallback()
                        }
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(36)
        .task {
            refreshExtensionState()
        }
    }

    private func refreshExtensionState() {
        SFSafariExtensionManager.getStateOfSafariExtension(
            withIdentifier: extensionIdentifier
        ) { state, _ in
            DispatchQueue.main.async {
                guard let state else { return }
                isEnabled = state.isEnabled
                if state.isEnabled {
                    message = "CCF Lens 已在 Safari 中启用。你可以在这里管理扩展设置。"
                }
            }
        }
    }

    private func openSafariFallback() {
        guard let safariURL = NSWorkspace.shared.urlForApplication(
            withBundleIdentifier: "com.apple.Safari"
        ) else {
            message = "请打开 Safari，然后前往 Safari → 设置 → 扩展，启用 CCF Lens。"
            return
        }

        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.openApplication(
            at: safariURL,
            configuration: configuration
        ) { _, _ in }
        message = "Safari 已打开。请前往 Safari → 设置 → 扩展，启用 CCF Lens。"
    }
}
