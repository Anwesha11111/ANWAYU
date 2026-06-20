import { Request, Response, NextFunction } from 'express';
import type { NetworkProfile } from '../types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      networkProfile: NetworkProfile;
      mediaConfig: MediaStreamConfig;
    }
  }
}

export interface MediaStreamConfig {
  profile:          NetworkProfile;
  videoBitrate_kbps: number;
  audioBitrate_kbps: number;
  resolution:       string;
  audioOnly:        boolean;
  chunkSize_kb:     number;
  bufferTarget_s:   number;
}

const MEDIA_PROFILES: Record<NetworkProfile, MediaStreamConfig> = {
  WiFi: {
    profile:           'WiFi',
    videoBitrate_kbps: 2500,
    audioBitrate_kbps: 192,
    resolution:        '1280x720',
    audioOnly:         false,
    chunkSize_kb:      512,
    bufferTarget_s:    10,
  },
  '4G': {
    profile:           '4G',
    videoBitrate_kbps: 1200,
    audioBitrate_kbps: 128,
    resolution:        '854x480',
    audioOnly:         false,
    chunkSize_kb:      256,
    bufferTarget_s:    15,
  },
  '3G': {
    profile:           '3G',
    videoBitrate_kbps: 400,
    audioBitrate_kbps: 64,
    resolution:        '426x240',
    audioOnly:         false,
    chunkSize_kb:      128,
    bufferTarget_s:    20,
  },
  '2G': {
    // 2G: drop to audio-only stream — payload too large for video
    profile:           '2G',
    videoBitrate_kbps: 0,
    audioBitrate_kbps: 32,
    resolution:        'audio_only',
    audioOnly:         true,
    chunkSize_kb:      32,
    bufferTarget_s:    30,
  },
};

const VALID_PROFILES = new Set<NetworkProfile>(['WiFi', '4G', '3G', '2G']);

/**
 * networkProfileMiddleware
 *
 * Reads X-Network-Profile header, maps to a MediaStreamConfig,
 * and attaches both to req for downstream controllers.
 * Defaults to '4G' if header is absent or invalid.
 */
export function networkProfileMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerVal = req.headers['x-network-profile'] as string | undefined;
  const profile: NetworkProfile = VALID_PROFILES.has(headerVal as NetworkProfile)
    ? (headerVal as NetworkProfile)
    : '4G';

  req.networkProfile = profile;
  req.mediaConfig    = MEDIA_PROFILES[profile];

  // Signal audio-only to client via response header
  if (profile === '2G') {
    res.setHeader('X-Stream-Mode', 'audio-only');
  }

  next();
}
