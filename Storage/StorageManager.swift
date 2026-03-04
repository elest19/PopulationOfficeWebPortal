import supabase
import Foundation

struct StorageManager {
    private let client: SupabaseClient

    init() {
        self.client = SupabaseClient(
            supabaseURL: URL(string: Constants.projectURLString)!,
            supabaseKey: Constants.projectAPIKey
        )
    }

    // Detect content type (basic). You can hardcode "image/jpeg" if you always send JPEG.
    private func detectContentType(from data: Data) -> String {
        if data.starts(with: [0xFF, 0xD8, 0xFF]) { return "image/jpeg" }     // JPEG
        if data.starts(with: [0x89, 0x50, 0x4E, 0x47]) { return "image/png" } // PNG
        return "application/octet-stream"
    }

    private func fileExtension(for mime: String) -> String {
        switch mime {
        case "image/jpeg": return "jpg"
        case "image/png": return "png"
        default: return "bin"
        }
    }

    // news bucket upload: news/{userId}/{year}/{month}/{uuid}.{ext}
    func uploadNewsImage(for user: User, imageData: Data) async throws -> String {
        let now = Date()
        let comps = Calendar.current.dateComponents([.year, .month], from: now)
        let year = comps.year ?? 1970
        let month = String(format: "%02d", comps.month ?? 1)

        let bucket = "news"
        let contentType = detectContentType(from: imageData)
        let ext = fileExtension(for: contentType)
        let filename = UUID().uuidString + "." + ext
        let path = "\(user.id)/\(year)/\(month)/\(filename)"

        let file = File(name: filename, data: imageData, type: contentType)

        _ = try await client.storage
            .from(bucket)
            .upload(
                path: path,
                file: file,
                fileOptions: FileOptions(
                    cacheControl: "3600",
                    upsert: false,
                    contentType: contentType
                )
            )

        let url = client.storage.from(bucket).getPublicUrl(path: path)
        return url.absoluteString
    }

    // announcements bucket upload: announcements/{announcementId}/{year}/{month}/{uuid}.{ext}
    func uploadAnnouncementImage(announcementId: String, imageData: Data) async throws -> String {
        let now = Date()
        let comps = Calendar.current.dateComponents([.year, .month], from: now)
        let year = comps.year ?? 1970
        let month = String(format: "%02d", comps.month ?? 1)

        let bucket = "announcements"
        let contentType = detectContentType(from: imageData)
        let ext = fileExtension(for: contentType)
        let filename = UUID().uuidString + "." + ext
        let path = "\(announcementId)/\(year)/\(month)/\(filename)"

        let file = File(name: filename, data: imageData, type: contentType)

        _ = try await client.storage
            .from(bucket)
            .upload(
                path: path,
                file: file,
                fileOptions: FileOptions(
                    cacheControl: "3600",
                    upsert: false,
                    contentType: contentType
                )
            )

        let url = client.storage.from(bucket).getPublicUrl(path: path)
        return url.absoluteString
    }
}