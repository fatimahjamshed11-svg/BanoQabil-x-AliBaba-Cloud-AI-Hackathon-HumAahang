import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createSpeechServer } from '../server.mjs';
import { readConfig } from '../config.mjs';
import { pslSignCatalog, validatePslSignCatalog, loadPslSignReferences } from '../psl-sign-catalog.mjs';
import { createVisionAnalyzer, validateVisionInput, validateVisionResult, VisionError, MAX_IMAGE_BYTES, MAX_VISION_BODY_BYTES } from '../vision.mjs';

const token = 'vision-test-private-demo-token-32-characters';
const image = { mimeType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4AAAAABJRU5ErkJggg==' };
const input = (language = 'ur', task = 'objects') => ({ image, language, task });
const result = (language = 'ur', task = 'objects') => ({ task,
  description: language === 'ur' ? 'میز پر ایک کپ نظر آ رہا ہے۔' : language === 'roman' ? 'Mez par aik cup nazar aa raha hai.' : 'A cup is visible on a table.',
  spokenDescription: language === 'en' ? 'A cup is visible on a table.' : 'میز پر ایک کپ نظر آ رہا ہے۔',
  objects: task === 'objects' ? (language === 'ur' ? ['کپ', 'میز'] : ['cup', 'table']) : [],
  gesture: task === 'gesture' ? 'other' : null, uncertain: task === 'gesture',
});
const providerResponse = output => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message',
  content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }), { headers: { 'Content-Type': 'application/json' } });
const failsWith = code => error => error instanceof VisionError && error.code === code;

async function fixture(t, dependencies = {}, config = {}) {
  const app = createSpeechServer({ clientToken: token, origins: ['http://localhost:8081'], ...config }, {
    convert: async () => [], ...dependencies,
  });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const post = (body = input(), headers = {}, path = '/v1/vision/analyze', signal) => fetch(`${url}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify(body), signal,
  });
  return { app, url, post };
}

test('Vision configuration is optional and never exposes or needs keys in the frontend', () => {
  const env = { STT_PROVIDER: 'deepgram', DEEPGRAM_API_KEY: 'a'.repeat(32), DEEPSEEK_API_KEY: 'b'.repeat(32), STT_CLIENT_TOKEN: token };
  assert.equal(readConfig(env).openaiKey, undefined);
  assert.equal(readConfig(env).openaiVisionModel, 'gpt-4.1-mini');
  assert.equal(readConfig({ ...env, OPENAI_VISION_MODEL: 'gpt-4.1-mini-2025-04-14' }).openaiVisionModel, 'gpt-4.1-mini-2025-04-14');
  assert.throws(() => readConfig({ ...env, OPENAI_API_KEY: 'replace_with_a_key' }), /OPENAI_API_KEY/);
  assert.throws(() => readConfig({ ...env, OPENAI_VISION_MODEL: 'https://other-provider.test' }), /OPENAI_VISION_MODEL/);
});

test('PSL catalog is bounded, validates its labels, and requires an image for every configured reference', () => {
  const catalog = [{ id: 'hello', nameEn: 'Hello', nameUr: 'سلام', visualCue: 'Open right hand, palm facing forward.' }];
  assert.deepEqual(validatePslSignCatalog(catalog), catalog);
  assert.throws(() => validatePslSignCatalog([...catalog, { ...catalog[0] }]), /Invalid PSL sign catalog/);
  assert.throws(() => validatePslSignCatalog(Array.from({ length: 11 }, (_, i) => ({ ...catalog[0], id: `sign-${i}` }))), /at most 10/);
  assert.throws(() => loadPslSignReferences(catalog), /Missing PSL reference image/);
  const references = loadPslSignReferences(pslSignCatalog);
  assert.equal(pslSignCatalog.length, 10);
  assert.deepEqual(references.map(({ id }) => id), pslSignCatalog.map(({ id }) => id));
  assert.ok(references.every(reference => reference.mimeType === 'image/jpeg' && reference.base64.length > 100));
  assert.ok(references.every(reference => reference.symbolMimeType === 'image/jpeg' && reference.symbolBase64.length > 100));
});

test('Vision input validates size, canonical base64, allowed MIME signatures and strict request fields', () => {
  assert.deepEqual(validateVisionInput(input()), input());
  for (const invalid of [null, {}, { ...input(), task: 'read_private_identity' }, { ...input(), language: 'hi' },
    { ...input(), extra: 'ignored?' }, { ...input(), image: { url: 'http://localhost/private' } }]) {
    assert.throws(() => validateVisionInput(invalid), error => error instanceof VisionError);
  }
  for (const badImage of [
    { ...image, mimeType: 'image/gif' }, { ...image, mimeType: 'image/jpeg' },
    { ...image, base64: '' }, { ...image, base64: `${image.base64}\n` },
    { ...image, base64: 'not+an+image'.repeat(8) },
    { ...image, base64: Buffer.alloc(MAX_IMAGE_BYTES + 1).toString('base64') },
    { ...image, base64: `data:image/png;base64,${image.base64}` },
  ]) assert.throws(() => validateVisionInput({ ...input(), image: badImage }), failsWith('invalid_image'));
  const jpeg = Buffer.alloc(24); jpeg.set([255, 216, 255]);
  assert.equal(validateVisionInput({ ...input(), image: { mimeType: 'image/jpeg', base64: jpeg.toString('base64') } }).task, 'objects');
  const webp = Buffer.alloc(24); webp.write('RIFF'); webp.write('WEBP', 8);
  assert.equal(validateVisionInput({ ...input(), image: { mimeType: 'image/webp', base64: webp.toString('base64') } }).task, 'objects');
});

test('Vision provider uses one bounded, non-stored Responses request and validated language-specific results', async () => {
  for (const language of ['ur', 'en', 'roman']) {
    let called = 0;
    const analyze = createVisionAnalyzer({ openaiKey: 'private-test-key', openaiVisionModel: 'gpt-4.1-mini' }, async (url, options) => {
      called++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.redirect, 'error');
      const body = JSON.parse(options.body);
      assert.equal(body.store, false); assert.equal(body.max_output_tokens, 1600);
      assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.strict, true);
      assert.deepEqual(body.text.format.schema.properties.task.enum, ['objects']);
      assert.deepEqual(body.text.format.schema.properties.gesture, { type: ['string', 'null'], enum: [null] });
      assert.equal(body.text.format.schema.properties.objects.maxItems, 12);
      assert.equal(body.text.format.schema.properties.objects.items.maxLength, 80);
      assert.deepEqual(body.text.format.schema.properties.uncertain.enum, [true, false]);
      assert.match(body.input[0].content[1].image_url, /^data:image\/png;base64,/);
      const request = JSON.parse(body.input[0].content[0].text);
      assert.equal(request.task, 'objects'); assert.equal(request.language, language);
      assert.ok(!options.body.includes('private-test-key'));
      return providerResponse(result(language));
    });
    assert.deepEqual(await analyze(input(language)), result(language)); assert.equal(called, 1);
  }
});

test('PSL analysis compares the uploaded still with configured references in one call and validates catalog IDs', async () => {
  const catalog = [{ id: 'hello', nameEn: 'Hello', nameUr: 'سلام', visualCue: 'Open right hand, palm facing forward.' }];
  const reference = { ...catalog[0], mimeType: 'image/jpeg', base64: Buffer.from('reference-image-placeholder').toString('base64'),
    symbolMimeType: 'image/jpeg', symbolBase64: Buffer.from('symbol-image-placeholder').toString('base64') };
  const expected = { ...result('ur', 'gesture'), gesture: 'hello', uncertain: true,
    description: 'اس اشارے کا ممکنہ مطلب سلام ہے، مگر نتیجے کی تصدیق کریں۔',
    spokenDescription: 'اس اشارے کا ممکنہ مطلب سلام ہے، مگر نتیجے کی تصدیق کریں۔' };
  let schema, instructionsText;
  const analyze = createVisionAnalyzer({ openaiKey: 'private-test-key', pslSignCatalog: catalog, pslReferenceImages: [reference] }, async (_, options) => {
    const body = JSON.parse(options.body), content = body.input[0].content;
    schema = body.text.format.schema; instructionsText = body.instructions;
    assert.ok(content.some(item => item.type === 'input_image' && item.image_url === `data:image/jpeg;base64,${reference.base64}`));
    assert.ok(content.some(item => item.type === 'input_image' && item.image_url === `data:image/jpeg;base64,${reference.symbolBase64}`));
    assert.ok(content.some(item => item.type === 'input_text' && item.text.includes('hello')));
    return providerResponse(expected);
  });
  assert.deepEqual(await analyze(input('ur', 'gesture')), expected);
  assert.match(instructionsText, /Compare the captured photo with the reference photos and simplified symbols/);
  assert.match(instructionsText, /lead with its concise conventional name/i);
  assert.match(instructionsText, /Do not substitute a description of hand posture for its name/i);
  assert.match(instructionsText, /Never expose catalog IDs, the reference set, or the comparison process/);
  assert.deepEqual(schema.properties.task.enum, ['gesture']);
  assert.deepEqual(schema.properties.gesture, { type: 'string', enum: ['hello', 'other', 'unknown'] });
  assert.equal(schema.properties.objects.maxItems, 0);
  assert.deepEqual(schema.properties.uncertain.enum, [true]);
  await assert.rejects(createVisionAnalyzer({ openaiKey: 'private-test-key', pslSignCatalog: catalog,
    pslReferenceImages: [reference] }, async () => providerResponse({ ...expected, gesture: 'unconfigured' }))(input('ur', 'gesture')), failsWith('vision_invalid'));
});

test('Vision rejects incorrect scripts, extra fields, wrong tasks and non-enumerated gesture translations', () => {
  for (const invalid of [
    { ...result(), description: 'A cup is here.' }, { ...result(), description: 'यह एक कप है।' },
    { ...result(), objects: ['cup'] }, { ...result(), spokenDescription: 'मेज' },
    { ...result(), description: 'کپ ३' }, { ...result(), description: 'کپ\u200b' },
    { ...result(), description: 'کپ\u202eabc' }, { ...result(), uncertain: 'false' },
    { ...result(), private: 'secret' }, { ...result(), objects: Array(13).fill('کپ') },
    { ...result(), gesture: 'thumbs_up' }, { ...result(), description: 'ک'.repeat(1001) },
  ]) assert.throws(() => validateVisionResult(invalid, input()), failsWith('vision_invalid'));
  assert.throws(() => validateVisionResult(result('ur'), input('en')), failsWith('vision_invalid'));
  assert.throws(() => validateVisionResult({ ...result('roman'), spokenDescription: 'Aik cup hai.' }, input('roman')), failsWith('vision_invalid'));
  assert.deepEqual(validateVisionResult(result('ur', 'gesture'), input('ur', 'gesture')), result('ur', 'gesture'));
  assert.throws(() => validateVisionResult({ ...result('ur', 'gesture'), gesture: 'hello' }, input('ur', 'gesture')), failsWith('vision_invalid'));
  assert.throws(() => validateVisionResult({ ...result('ur', 'gesture'), gesture: 'hello' }, input('ur', 'gesture'), ['greet']), failsWith('vision_invalid'));
  assert.throws(() => validateVisionResult({ ...result('ur', 'gesture'), gesture: 'unknown', uncertain: false }, input('ur', 'gesture')), failsWith('vision_invalid'));
  assert.equal(validateVisionResult({ ...result('ur', 'gesture'), gesture: 'unknown', uncertain: true }, input('ur', 'gesture')).uncertain, true);
});

test('Missing configuration, provider failure/refusal, malformed output and oversized responses fail without leakage', async () => {
  let calls = 0;
  await assert.rejects(createVisionAnalyzer({}, async () => { calls++; })(input()), failsWith('vision_unavailable'));
  assert.equal(calls, 0);
  const cases = [
    [async () => new Response('secret provider detail', { status: 401 }), 'vision_unavailable'],
    [async () => { throw new Error('private-key server detail'); }, 'vision_unavailable'],
    [async () => new Response('not-json private detail'), 'vision_invalid'],
    [async () => providerResponse({ ...result(), description: 'Hindi गुप्त' }), 'vision_invalid'],
    [async () => new Response('a'.repeat(65537)), 'vision_invalid'],
    [async () => new Response(JSON.stringify({ status: 'incomplete', output: [] })), 'vision_invalid'],
    [async () => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'private provider text' }] }] })), 'vision_refused'],
  ];
  for (const [provider, code] of cases) {
    await assert.rejects(createVisionAnalyzer({ openaiKey: 'private-test-key' }, provider)(input()), error => {
      assert.equal(error.message, code); return failsWith(code)(error);
    });
  }
});

test('Provider timeout and caller cancellation abort the in-flight request', async () => {
  const blockedFetch = async (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(createVisionAnalyzer({ openaiKey: 'private', visionTimeoutMs: 20 }, blockedFetch)(input()), failsWith('vision_timeout'));
  const controller = new AbortController();
  const request = createVisionAnalyzer({ openaiKey: 'private' }, blockedFetch)(input(), controller.signal);
  controller.abort(); await assert.rejects(request, error => error.name === 'AbortError');
  let calls = 0;
  await assert.rejects(createVisionAnalyzer({ openaiKey: 'private' }, async () => { calls++; })(input(), controller.signal));
  assert.equal(calls, 0);
});

test('Vision route protects authorization, origin, upload length and type before any provider call', async t => {
  let calls = 0;
  const f = await fixture(t, { analyzeVision: async () => { calls++; return result(); } });
  assert.equal((await f.post(input(), { Authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await f.post(input(), { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await f.post(input(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.post({ ...input(), image: { ...image, base64: 'oops' } })).status, 400);
  assert.equal((await f.post({ padding: 'a'.repeat(MAX_VISION_BODY_BYTES) })).status, 413);
  assert.equal(calls, 0);
  const response = await f.post(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), result());
  assert.equal(calls, 1);
});

test('Vision route accepts only configured PSL catalog IDs and keeps every result reviewable', async t => {
  const catalog = [{ id: 'hello', nameEn: 'Hello', nameUr: 'سلام', visualCue: 'Open right hand, palm facing forward.' }];
  const expected = { ...result('ur', 'gesture'), gesture: 'hello', uncertain: true };
  const f = await fixture(t, { analyzeVision: async () => expected }, { pslSignCatalog: catalog });
  const response = await f.post(input('ur', 'gesture'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
  const bad = await fixture(t, { analyzeVision: async () => ({ ...expected, gesture: 'not-in-catalog' }) }, { pslSignCatalog: catalog });
  assert.equal((await bad.post(input('ur', 'gesture'))).status, 502);
});

test('Vision accepts paired grants and revocation/origin binding also applies to images', async t => {
  let calls = 0;
  const f = await fixture(t, { analyzeVision: async () => { calls++; return result(); } });
  const origin = 'http://localhost:8081';
  const pairing = await f.post({ code: f.app.newPairingCode() }, { Origin: origin }, '/v1/stt/clients');
  const grant = await pairing.json();
  const headers = { Origin: origin, Authorization: `Bearer ${grant.token}` };
  assert.equal((await f.post(input(), headers)).status, 200);
  assert.equal((await f.post(input(), { ...headers, Origin: 'humahang://native' })).status, 401);
  await fetch(`${f.url}/v1/stt/clients`, { method: 'DELETE', headers });
  assert.equal((await f.post(input(), headers)).status, 401);
  assert.equal(calls, 1);
});

test('Missing Vision key only disables Vision, leaving STT health and session setup intact', async t => {
  const f = await fixture(t);
  const response = await f.post(); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: 'vision_unavailable' });
  assert.equal((await fetch(`${f.url}/health`)).status, 200);
  assert.equal((await f.post({ audio: { encoding: 'linear16', sampleRate: 16000, channels: 1 } }, {}, '/v1/stt/sessions')).status, 201);
});

test('Vision rate and concurrent request caps prevent duplicate provider load', async t => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const f = await fixture(t, { analyzeVision: async () => { started(); await new Promise(resolve => { release = resolve; }); return result(); } },
    { maxVisionRequests: 1, visionRequestsPerMinute: 2 });
  const first = f.post(); await ready;
  const busy = await f.post(); assert.equal(busy.status, 429); assert.deepEqual(await busy.json(), { code: 'vision_busy' });
  release(); assert.equal((await first).status, 200);
  const capped = await f.post(); assert.equal(capped.status, 429); assert.deepEqual(await capped.json(), { code: 'rate_limited' });
});

test('Disconnecting the client cancels provider work and releases capacity', async t => {
  let started, aborted;
  const ready = new Promise(resolve => { started = resolve; });
  const cancelled = new Promise(resolve => { aborted = resolve; });
  const f = await fixture(t, { analyzeVision: async (_, signal) => new Promise((resolve, reject) => {
    started(); signal.addEventListener('abort', () => { aborted(); reject(signal.reason); }, { once: true });
  }) });
  const controller = new AbortController();
  const pending = f.post(input(), {}, '/v1/vision/analyze', controller.signal); await ready;
  controller.abort(); await assert.rejects(pending, error => error.name === 'AbortError');
  await cancelled;
});

test('Server shutdown aborts an active Vision request', async t => {
  let started, wasAborted = false;
  const ready = new Promise(resolve => { started = resolve; });
  const f = await fixture(t, { analyzeVision: async (_, signal) => new Promise((resolve, reject) => {
    started(); signal.addEventListener('abort', () => { wasAborted = true; reject(signal.reason); }, { once: true });
  }) });
  const pending = f.post(); await ready; await f.app.close(); await pending;
  assert.equal(wasAborted, true);
});
