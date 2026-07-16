# Windows TTS Manual Test Plan

Real Windows Greek and Hebrew speech remains unverified until this plan passes on physical or virtual Windows 10 and Windows 11 systems.

## Build Under Test

Record the Git commit, Windows version, installer filename, installation type (MSI or NSIS), and whether the package is unsigned. Install the package normally and open **Settings > TTS Diagnostics** before each inventory scenario.

## Voice Inventories

Run the matrix on both Windows 10 and Windows 11:

| Inventory | Expected English | Expected Greek | Expected Hebrew |
| --- | --- | --- | --- |
| English only | Available | Unavailable | Unavailable |
| English + Greek | Available | Available | Unavailable |
| English + Hebrew | Available | Unavailable | Available |
| English + Greek + Hebrew | Available | Available | Available |
| No compatible voices | Unavailable | Unavailable | Unavailable |

For Hebrew, include a machine or mocked system inventory that reports legacy `iw` or `iw-IL` locale tags. Diagnostics must classify those voices as Hebrew. No Greek or Hebrew action may silently use an English voice.

## Functional Checks

1. Refresh diagnostics and record the selected native and browser voice for each language.
2. Play the English sample and confirm intelligible English output.
3. Play the Greek sample with diacritics and confirm a Greek voice is selected.
4. Play the Hebrew sample with vowel points and confirm a Hebrew voice is selected.
5. With Greek absent, press **Test Greek** and confirm a clear unavailable-voice error instead of English speech.
6. With Hebrew absent, press **Test Hebrew** and confirm a clear unavailable-voice error instead of English speech.
7. Repeat Play and Stop Speech at least ten times.
8. Rapidly alternate Greek and Hebrew playback, stopping between selections.
9. Start speech, put Windows to sleep, resume, and verify diagnostics and playback recover without restarting when the OS supports it.
10. Restart Rhelo and verify the voice inventory remains accurate.

## Diagnostic Capture

Capture the Settings diagnostics panel and application logs. Logs may include OS, requested language, normalized locale, character count, selected voice name, selected voice locale, and categorized error code. Do not log or paste the full spoken text. Redact usernames or machine-specific paths before sharing logs.

If a voice is missing, install it through **Windows Settings > Time & language > Speech** (wording varies by Windows version), restart Rhelo, refresh diagnostics, and rerun the affected case.
