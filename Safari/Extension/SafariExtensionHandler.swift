import Foundation
import SafariServices

final class SafariExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let reply = NSExtensionItem()
        reply.userInfo = [SFExtensionMessageKey: ["ready": true]]
        context.completeRequest(returningItems: [reply])
    }
}
