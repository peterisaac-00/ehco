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

## Packager health endpoint

The Expo/Metro health route was measured directly on 2026-08-14. Local HTTP, forwarded Manus HTTP, and forwarded Manus HTTPS each returned `200` with the exact body `packager-status:running`. Neither forwarded request returned a redirect. This rules out an HTTP-to-HTTPS redirect or altered `/status` response as the explanation for the Android message.

For context, Expo documents historical Packager status failures at `https://github.com/expo/expo-cli/issues/52`; the documented failure condition is inability to reach `/status`, which was not observed here. Expo maintainers also identify device-to-host connectivity as the relevant boundary for the same message at `https://github.com/expo/expo/issues/8606`.

## Published-case review

Community reports commonly suggest tunnels, cache resets, LAN/firewall changes, or Expo Go reinstallations. The first three have already been tested or are inapplicable to the managed remote host. One remaining evidence-based possibility is SDK compatibility: the active Android manifest advertises `sdkVersion: 54.0.0` and `runtimeVersion: exposdk:54.0.0`, while the project installs `expo` 54.0.29. Expo's official Android guidance is to install the Expo Go build that matches the project's SDK from `https://expo.dev/go`, then restart the server. See `https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/` and `https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/`.

The downloaded Stack Overflow case at `https://stackoverflow.com/questions/79332816/uncaught-error-java-io-ioexception-failed-to-download-remote-update` reports SDK mismatch as a successful remedy for a similar Android remote-update symptom. It is a candidate to verify on the device, not proof that it is the cause in Ehco.

## WebSocket transport result

On 2026-08-14, WebSocket upgrade requests to the forwarded Manus origin were tested on the Metro paths `/message`, `/hot?platform=android&dev=true`, and `/onchange`. Every path returned `502 Bad Gateway` over both HTTP and HTTPS. In contrast, the ordinary `/status` request returned `200` and `packager-status:running` over both protocols. This is a direct transport failure in the forwarded WebSocket path and matches the observed Expo Go behavior; it is not caused by any Ehco screen, API route, database operation, or Metro health endpoint.
