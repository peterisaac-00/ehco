# Expo Packager Evidence

- Official Expo CLI documentation: https://docs.expo.dev/more/expo-cli/
  - `npx expo start` runs Metro on port 8081 by default.
  - `--tunnel` exposes a public tunnel URL for physical devices outside the host network.
  - Expo documents tunnel availability as dependent on the third-party tunnel service.

- Current direct-tunnel observation (2026-08-14): Metro reported `Tunnel connected` and `Tunnel ready` after starting Expo Go with `--tunnel`.
- The Android Expo manifest currently advertises the direct tunnel launch asset host `http://ppbkuzg-anonymous-8081.exp.direct` rather than the Manus forwarded host.

This file records externally sourced and externally reachable diagnostic evidence only; it does not alter application behavior.

## Transport results

The direct Expo tunnel completed its connection and returned a valid Android manifest plus a successful WebSocket upgrade. It did not provide usable bundle delivery: a full Android bundle download reached only 1,884,708 bytes in 180 seconds, at approximately 10,470 bytes per second, while the bundle is 10,805,358 bytes. The direct tunnel is therefore not a reliable physical-device remedy in this environment.

The Manus-forwarded origin returned a valid Expo manifest, Android JavaScript bundle, and WebSocket upgrade when tested from the sandbox. The Android device nevertheless reports the Packager as unavailable. This separates the app source and local Metro process from the remaining failure point, which lies on the physical-device-to-forwarded-origin path or in the hosted Expo Go/forwarding integration.

## Compatibility check

`expo-doctor` reported missing `expo-asset` as a peer dependency of `expo-audio` for builds outside Expo Go and listed patch-level Expo SDK 54 package mismatches. Neither result explains a Packager error before the JavaScript bundle has loaded, so no dependency upgrade was applied during this diagnosis.
