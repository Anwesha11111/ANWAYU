import { networkProfileMiddleware, MediaStreamConfig } from '../middleware/networkProfile.middleware';
import { Request, Response, NextFunction } from 'express';

function makeNetworkMocks(profile?: string) {
  const req = {
    headers: profile ? { 'x-network-profile': profile } : {},
  } as unknown as Request;

  const setHeader = jest.fn();
  const res = { setHeader } as unknown as Response;
  const next = jest.fn() as NextFunction;

  return { req, res, next, setHeader };
}

describe('Network Profile Middleware', () => {
  test('sets WiFi profile and full video config', () => {
    const { req, res, next } = makeNetworkMocks('WiFi');
    networkProfileMiddleware(req, res, next);
    expect(req.networkProfile).toBe('WiFi');
    expect(req.mediaConfig.audioOnly).toBe(false);
    expect(req.mediaConfig.videoBitrate_kbps).toBe(2500);
    expect(next).toHaveBeenCalled();
  });

  test('sets 4G profile with reduced bitrate', () => {
    const { req, res, next } = makeNetworkMocks('4G');
    networkProfileMiddleware(req, res, next);
    expect(req.networkProfile).toBe('4G');
    expect(req.mediaConfig.videoBitrate_kbps).toBe(1200);
    expect(req.mediaConfig.resolution).toBe('854x480');
  });

  test('sets 3G profile with low bitrate', () => {
    const { req, res, next } = makeNetworkMocks('3G');
    networkProfileMiddleware(req, res, next);
    expect(req.mediaConfig.videoBitrate_kbps).toBe(400);
  });

  test('2G profile enforces audio-only stream', () => {
    const { req, res, next, setHeader } = makeNetworkMocks('2G');
    networkProfileMiddleware(req, res, next);
    expect(req.networkProfile).toBe('2G');
    expect(req.mediaConfig.audioOnly).toBe(true);
    expect(req.mediaConfig.videoBitrate_kbps).toBe(0);
    expect(req.mediaConfig.resolution).toBe('audio_only');
    expect(setHeader).toHaveBeenCalledWith('X-Stream-Mode', 'audio-only');
  });

  test('invalid profile defaults to 4G', () => {
    const { req, res, next } = makeNetworkMocks('5G');
    networkProfileMiddleware(req, res, next);
    expect(req.networkProfile).toBe('4G');
  });

  test('missing header defaults to 4G', () => {
    const { req, res, next } = makeNetworkMocks();
    networkProfileMiddleware(req, res, next);
    expect(req.networkProfile).toBe('4G');
  });
});
