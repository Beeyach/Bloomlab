import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { VoiceCharacterSchema, VOICE_LINE_KINDS } from '../src/index.ts';
import { compileContentDir, validateSources } from '../src/node.ts';
import { baseSources, withFile, yaml } from './fixtures.ts';

const root = fileURLToPath(new URL('../../../content', import.meta.url));
const voice = VoiceCharacterSchema.parse(
  parse(readFileSync(`${root}/voice-characters/VC-measured-founder.yaml`, 'utf8')),
);
describe('VOI-001/002/004 authored voice registry', () => {
  it.each([
    'client',
    'voice_id',
    'speech_rate',
    'style',
    'stability',
    'allowed_emotion_range',
    'language',
  ])('requires %s', (field) => {
    const record: Record<string, unknown> = { ...voice };
    delete record[field];
    expect(VoiceCharacterSchema.safeParse(record).success).toBe(false);
  });
  it.each(['', 'placeholder', 'replace-me', '../private', 'a'.repeat(19), 'example00000000000000'])(
    'refuses invalid provider identity %s',
    (id) => {
      expect(VoiceCharacterSchema.safeParse({ ...voice, voice_id: id }).success).toBe(false);
    },
  );
  it('rejects duplicate line IDs and emotions outside the character range', () => {
    expect(
      VoiceCharacterSchema.safeParse({ ...voice, lines: [voice.lines[0], voice.lines[0]] }).success,
    ).toBe(false);
    expect(
      VoiceCharacterSchema.safeParse({
        ...voice,
        lines: [{ ...voice.lines[0], emotion: 'unapproved' }],
      }).success,
    ).toBe(false);
  });
  it('resolves every current client and covers the six kinds for each with stable distinct catalog IDs', async () => {
    const bundle = await compileContentDir(root);
    expect(bundle.voice_characters).toHaveLength(bundle.clients.length);
    expect(new Set(bundle.voice_characters.map((v) => v.voice_id)).size).toBe(
      bundle.clients.length,
    );
    for (const client of bundle.clients) {
      const v = bundle.voice_characters.find((v) => v.id === client.voice.character)!;
      expect(v.client).toBe(client.id);
      expect(new Set(v.lines.map((l) => l.kind))).toEqual(new Set(VOICE_LINE_KINDS));
    }
  });
  it('fails compilation for a missing registry reference', async () => {
    const result = await validateSources(withFile('voice-characters/VC-calm.yaml', null));
    expect(result.bundle).toBeNull();
    expect(result.issues.some((i) => i.code === 'MISSING_VOICE_CHARACTER')).toBe(true);
  });
  it('rejects client/voice mismatches in both directions', async () => {
    const sources = baseSources();
    const value = parse(sources.files['voice-characters/VC-calm.yaml']!) as Record<string, unknown>;
    for (const patch of [{ client: 'CL-missing' }, { id: 'VC-other' }]) {
      const file = patch.id ? `voice-characters/${patch.id}.yaml` : 'voice-characters/VC-calm.yaml';
      const result = await validateSources(withFile(file, yaml({ ...value, ...patch }), sources));
      expect(result.bundle).toBeNull();
      expect(
        result.issues.some((i) => ['MISSING_CLIENT', 'VOICE_CLIENT_MISMATCH'].includes(i.code)),
      ).toBe(true);
    }
  });
});
