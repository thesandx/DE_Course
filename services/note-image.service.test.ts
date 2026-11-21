// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveObject = vi.fn<(path: string, bytes: Uint8Array, type: string) => Promise<void>>();
const createSignedReadUrl = vi.fn<(path: string, ttl: number) => Promise<string>>();

vi.mock('@/services/storage.service', () => ({
  saveObject: (path: string, bytes: Uint8Array, type: string) => saveObject(path, bytes, type),
  createSignedReadUrl: (path: string, ttl: number) => createSignedReadUrl(path, ttl),
}));

const { isJpeg, noteImageUrl, saveNoteImage } = await import('./note-image.service');

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe('note images in the bucket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveObject.mockResolvedValue();
    createSignedReadUrl.mockResolvedValue('https://storage.example/signed');
  });

  it('stores a JPEG in the learner’s own folder under a random id', async () => {
    const id = await saveNoteImage('uid123', JPEG);
    expect(id).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(saveObject).toHaveBeenCalledWith(`note-images/uid123/${id}.jpg`, JPEG, 'image/jpeg');
    expect(await saveNoteImage('uid123', JPEG)).not.toBe(id);
  });

  it('refuses bytes that are not a JPEG, empty or too large', async () => {
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    await expect(saveNoteImage('uid123', new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).rejects.toThrow(
      'JPEG',
    );
    await expect(saveNoteImage('uid123', new Uint8Array())).rejects.toThrow('empty');
    const big = new Uint8Array(1_600_000);
    big.set([0xff, 0xd8, 0xff]);
    await expect(saveNoteImage('uid123', big)).rejects.toThrow('too large');
    expect(saveObject).not.toHaveBeenCalled();
  });

  it('signs a read URL only inside the session’s folder, for a well-formed id', async () => {
    await noteImageUrl('uid123', 'aB3dE5fG7hJ9kL1mN3pQ5rS7');
    expect(createSignedReadUrl).toHaveBeenCalledWith(
      'note-images/uid123/aB3dE5fG7hJ9kL1mN3pQ5rS7.jpg',
      expect.any(Number),
    );
    await expect(noteImageUrl('uid123', '../other/x')).rejects.toThrow();
  });
});
