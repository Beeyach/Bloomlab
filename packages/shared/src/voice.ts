/** Non-secret review metadata; storage keys and provider credentials never cross this boundary. */
export interface VoiceAssetStatus {
  asset_id: string;
  character_id: string;
  line_id: string;
  available: boolean;
  byte_length: number | null;
}
