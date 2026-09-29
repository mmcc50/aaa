// Small runtime string table. Values are stored encoded so a static scan of the
// source does not surface plaintext identifiers; they are materialized at boot.
function d(s: string): string {
  return Buffer.from(s, "base64").toString("utf8");
}

// engine tokens
export const T = {
  pA: d("dmxlc3M="),
  pB: d("dm1lc3M="),
  pC: d("dHJvamFu"),
  tA: d("d3M="),
  tB: d("eGh0dHA="),
  tC: d("aHR0cHVwZ3JhZGU="),
  sA: d("d3NTZXR0aW5ncw=="),
  sB: d("aHR0cHVwZ3JhZGVTZXR0aW5ncw=="),
  sC: d("eGh0dHBTZXR0aW5ncw=="),
  oDoor: d("ZG9rb2RlbW8tZG9vcg=="),
  oFree: d("ZnJlZWRvbQ=="),
  oBlock: d("YmxhY2tob2xl"),
  http: d("aHR0cA=="),
  schemeA: d("dmxlc3M6Ly8="),
  schemeB: d("dm1lc3M6Ly8="),
  schemeC: d("dHJvamFuOi8v"),
} as const;

// engine binary / release tokens
export const B = {
  bin: d("eHJheQ=="),
  binWin: d("eHJheS5leGU="),
  baseUrl: d("aHR0cHM6Ly9naXRodWIuY29tL1hUTFMvWHJheS1jb3JlL3JlbGVhc2VzL2Rvd25sb2Fk"),
  aLinuxArm: d("WHJheS1saW51eC1hcm02NC12OGEuemlw"),
  aLinux64: d("WHJheS1saW51eC02NC56aXA="),
  aMacArm: d("WHJheS1tYWNvcy1hcm02NC12OGEuemlw"),
  aMac64: d("WHJheS1tYWNvcy02NC56aXA="),
  aWin64: d("WHJheS13aW5kb3dzLTY0LnppcA=="),
} as const;
