import assert from "node:assert/strict";
import test from "node:test";

import { detectTtsAvailabilityWith } from "../src/hooks/useTtsDetector";
import type { TtsDiagnosticsResponse } from "../src/lib/api";
import { getBrowserTtsDiagnosticsFrom, selectBrowserVoice } from "../src/lib/speech";
import {
  clearRecoveryForDetectedLanguage,
  consumeFocusRefresh,
  createTtsSettingsTarget,
  isWindowsPlatform,
  mergeRecoveryDetail,
  shouldRecoverMissingVoice,
  type TtsRecoveryDetail,
} from "../src/lib/ttsRecovery";
import { openWindowsSettingsWith } from "../src/utils/SystemHelper";

const voice = (name: string, lang: string) => ({
  default: false,
  lang,
  localService: true,
  name,
  voiceURI: name,
}) as SpeechSynthesisVoice;

const recovery = (language: "greek" | "hebrew", actionId = 1): TtsRecoveryDetail => ({
  actionId,
  language,
  requestedLanguage: language === "greek" ? "el" : "he",
  normalizedLocale: language === "greek" ? "el-gr" : "he-il",
  platform: "Windows 11",
  nativeVoiceFound: false,
  browserVoiceFound: false,
  code: "voice-unavailable",
  message: "No compatible voice",
});

const diagnostics = (greek = false, hebrew = false): TtsDiagnosticsResponse => {
  const selection = (requested: string, available: boolean) => ({
    requested_language: requested,
    normalized_locale: requested,
    selected_voice: available ? { name: `${requested} voice`, language: requested } : null,
    available,
    reason: available ? null : "missing",
  });
  return {
    os: "windows",
    native_tts_available: true,
    initialization_error: null,
    current_schema_version: 1,
    detected_voices: [],
    english: selection("en-us", true),
    greek: selection("el-gr", greek),
    hebrew: selection("he-il", hebrew),
  };
};

test("missing Greek and Hebrew voices create recovery state, but English and cancellation do not", () => {
  assert.equal(shouldRecoverMissingVoice("voice-unavailable", "el-GR"), true);
  assert.equal(shouldRecoverMissingVoice("browser-fallback-unavailable", "he-IL"), true);
  assert.equal(shouldRecoverMissingVoice("voice-unavailable", "en-US"), false);
  assert.equal(shouldRecoverMissingVoice("cancelled", "el-GR"), false);
});

test("one speech action creates one popup and a later action may replace it", () => {
  const first = recovery("greek", 7);
  assert.equal(mergeRecoveryDetail(first, recovery("greek", 7)), first);
  assert.equal(mergeRecoveryDetail(first, recovery("hebrew", 8)).language, "hebrew");
});

test("English voices are never selected for Greek or Hebrew", () => {
  const voices = [voice("English Desktop", "en-US")];
  assert.equal(selectBrowserVoice(voices, "el"), null);
  assert.equal(selectBrowserVoice(voices, "he"), null);
  const result = getBrowserTtsDiagnosticsFrom(voices);
  assert.equal(result.greek, null);
  assert.equal(result.hebrew, null);
});

test("compatible original-language browser voices remain usable", async () => {
  const voices = [voice("Greek Desktop", "el-GR"), voice("Hebrew Desktop", "he-IL")];
  assert.equal(selectBrowserVoice(voices, "el")?.name, "Greek Desktop");
  assert.equal(selectBrowserVoice(voices, "he")?.name, "Hebrew Desktop");
  assert.equal((await detectTtsAvailabilityWith("el", async () => diagnostics(), voices)).status, "ready");
  assert.equal((await detectTtsAvailabilityWith("he", async () => diagnostics(), voices)).status, "ready");
});

test("voice refresh re-enumerates the supplied inventory", async () => {
  const before = await detectTtsAvailabilityWith("el", async () => diagnostics(), []);
  const after = await detectTtsAvailabilityWith("el", async () => diagnostics(), [voice("Greek Desktop", "el-GR")]);
  assert.equal(before.status, "missing");
  assert.equal(after.status, "ready");
  assert.equal(after.selectedVoice, "Greek Desktop");
});

test("settings target preserves the missing language without session state", () => {
  assert.deepEqual(createTtsSettingsTarget("hebrew", 42), {
    section: "tts",
    missingLanguage: "hebrew",
    requestId: 42,
  });
});

test("detected language clears only its matching warning", () => {
  assert.equal(clearRecoveryForDetectedLanguage(recovery("greek"), "greek"), null);
  assert.equal(clearRecoveryForDetectedLanguage(recovery("hebrew"), "greek")?.language, "hebrew");
});

test("application focus consumes a pending settings refresh once", () => {
  assert.deepEqual(consumeFocusRefresh(true), { shouldRefresh: true, pending: false });
  assert.deepEqual(consumeFocusRefresh(false), { shouldRefresh: false, pending: false });
});

test("Windows guidance is platform-gated", () => {
  assert.equal(isWindowsPlatform("Windows 11"), true);
  assert.equal(isWindowsPlatform("MacIntel"), false);
});

test("Windows Language Settings uses the restricted native command and reports URI failure", async () => {
  let call: unknown[] | null = null;
  const opened = await openWindowsSettingsWith(async (command, args) => {
    call = [command, args];
    return {
      opened: true,
      requested_page: "language",
      opened_uri: "ms-settings:regionlanguage",
      used_fallback: false,
      error: null,
    };
  }, "language", "Windows 11");
  assert.deepEqual(call, ["open_windows_settings", { page: "language" }]);
  assert.equal(opened.opened_uri, "ms-settings:regionlanguage");

  const failed = await openWindowsSettingsWith(async () => ({
    opened: false,
    requested_page: "language",
    opened_uri: null,
    used_fallback: false,
    error: "URI unavailable; use manual instructions",
  }), "language", "Windows 11");
  assert.equal(failed.opened, false);
  assert.match(failed.error || "", /manual instructions/);
});

test("macOS never invokes the Windows settings command", async () => {
  let invoked = false;
  const result = await openWindowsSettingsWith(async () => {
    invoked = true;
    throw new Error("should not run");
  }, "language", "MacIntel");
  assert.equal(invoked, false);
  assert.equal(result.opened, false);
});
