export interface AttachmentResponse {
  id: string;
  uid: string;
  name: string | null;
  contentType: string | null;
  contentLength: number | null;
  url: string; // Download URL
}
