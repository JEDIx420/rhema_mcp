# [2026-07-20] Rhelo Desktop Beta 1 — v0.1.1

This is a private beta release for desktop testing.

## Downloads

### macOS - Apple Silicon

For M1, M2, M3 and M4 Macs.

Asset: `Rhelo-Desktop-v0.1.1-Beta1-2026.07.20-macOS-Apple-Silicon.dmg`

<!-- INTEL_DOWNLOAD_START -->
### macOS - Intel

For Intel-based Macs.

Asset: `Rhelo-Desktop-v0.1.1-Beta1-2026.07.20-macOS-Intel.dmg`

This asset is included only when the optional Intel build succeeds.
<!-- INTEL_DOWNLOAD_END -->

### Windows

For Windows 10 and Windows 11 x64.

Asset: `Rhelo-Desktop-v0.1.1-Beta1-2026.07.20-Windows-x64.msi`

## What Changed

- Updated Rhelo desktop branding
- Dictionary research-pane and related-reference improvements
- Runtime database migration safeguards
- Greek and Hebrew TTS diagnostics
- Stable macOS and Windows installer builds
- Desktop build and release-pipeline fixes

## macOS Notes

The beta workflow does not configure Apple code signing or notarization, so these DMGs should be treated as unsigned and unnotarized. Testers may need to Control-click Rhelo, choose **Open**, and confirm the prompt, or allow it from **System Settings > Privacy & Security**. Intel compatibility applies only when the separately named Intel DMG is attached to the release.

## Windows Notes

The beta workflow does not configure Windows code signing. Microsoft Defender SmartScreen may warn when opening the MSI; testers should verify the checksum before proceeding. Greek and Hebrew TTS depend on compatible voices installed in Windows.

## Known Beta Limitations

- Maps require internet connectivity for base-map tiles
- Some Strong's Hebrew occurrence matching uses normalized token fallback
- Signing and notarization are not yet configured
- Testers should back up important study sessions
- This is not the final public stable release

## Build Information

- Product: Rhelo Desktop
- Version: 0.1.1
- Channel: Beta
- Beta iteration: 1
- Release date: 2026-07-20
- Git tag: `desktop-v0.1.1-beta.1-2026.07.20`
- Commit SHA: `{{COMMIT_SHA}}`

## Checksums

See `SHA256SUMS.txt` attached to this release.
