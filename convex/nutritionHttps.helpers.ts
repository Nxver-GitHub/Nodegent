"use node";
/**
 * HTTPS fetch for nutrition.sa.ucsc.edu (dining menus).
 *
 * That server sends the wrong intermediate: its leaf is issued by
 * "InCommon ECC OV SSL CA 3" but it serves "InCommon RSA Server CA 2". Browsers
 * and macOS curl repair the chain via AIA; Node (Next.js routes, Convex Node
 * actions) does not, so plain fetch fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
 * We trust Node's bundled roots plus the correct intermediate — verification stays
 * on. Node-only: import from "use node" Convex modules or Next.js routes.
 *
 * Source: http://crt.sectigo.com/InCommonECCOVSSLCA3.crt (leaf AIA), valid to
 * 2035-11-05. Remove once UCSC fixes the server chain.
 */

import https from "node:https";
import tls from "node:tls";

export const INCOMMON_ECC_OV_SSL_CA_3 = `-----BEGIN CERTIFICATE-----
MIIDNjCCArygAwIBAgIQOHk0l89NJv2948rV3tVF/zAKBggqhkjOPQQDAzBfMQsw
CQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQDEy1T
ZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBFNDYwHhcN
MjUxMTA2MDAwMDAwWhcNMzUxMTA1MjM1OTU5WjBIMQswCQYDVQQGEwJVUzEWMBQG
A1UEChMNSW5Db21tb24sIExMQzEhMB8GA1UEAxMYSW5Db21tb24gRUNDIE9WIFNT
TCBDQSAzMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEI+ejNeQ1LxNI1+tUq8zJ
qYGVjJtq0ehfh/urxTAnMdocLMkAYGW4bc3hUgnDq2P2bpAnt8kvEHsSms9+eZ9C
NKOCAW8wggFrMB8GA1UdIwQYMBaAFNEi2kxZ8UtfJjiqndbu6w3D+6lhMB0GA1Ud
DgQWBBTOcO80VCw+mDhxIld7K0RZkFG+GTAOBgNVHQ8BAf8EBAMCAYYwEgYDVR0T
AQH/BAgwBgEB/wIBADATBgNVHSUEDDAKBggrBgEFBQcDATATBgNVHSAEDDAKMAgG
BmeBDAECAjBUBgNVHR8ETTBLMEmgR6BFhkNodHRwOi8vY3JsLnNlY3RpZ28uY29t
L1NlY3RpZ29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RFNDYuY3JsMIGE
BggrBgEFBQcBAQR4MHYwTwYIKwYBBQUHMAKGQ2h0dHA6Ly9jcnQuc2VjdGlnby5j
b20vU2VjdGlnb1B1YmxpY1NlcnZlckF1dGhlbnRpY2F0aW9uUm9vdEU0Ni5wN2Mw
IwYIKwYBBQUHMAGGF2h0dHA6Ly9vY3NwLnNlY3RpZ28uY29tMAoGCCqGSM49BAMD
A2gAMGUCMQCgENV+enAFTkpPIXg6u7yCsAq+bkjiJvBsVonfnqY0hVAftb8D39Bt
5Wf8NlBZRF4CMF/znj8ZRYNUgxY2o0/nzEiJ3hJBuYuUmfpbYc5BcBsy+vItNAQ7
mHOhDI5rvYg6LA==
-----END CERTIFICATE-----
`;

const NUTRITION_HOST = "nutrition.sa.ucsc.edu";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;

// Trust store = Node's bundled roots + the missing intermediate (not a pin).
const CA = [...tls.rootCertificates, INCOMMON_ECC_OV_SSL_CA_3];

// One agent so the CA list is parsed into a SecureContext once, not per request.
const agent = new https.Agent({ ca: CA });

/** Throws unless `raw` is an https URL on the nutrition host. */
export function assertNutritionUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.hostname !== NUTRITION_HOST) {
    throw new Error("Only https://nutrition.sa.ucsc.edu URLs are allowed");
  }
  return url;
}

export interface NutritionPage {
  status: number;
  body: string;
}

/** GETs a nutrition.sa.ucsc.edu page with full TLS verification. No redirects. */
export function fetchNutritionPage(
  rawUrl: string,
  headers: Record<string, string>
): Promise<NutritionPage> {
  const url = assertNutritionUrl(rawUrl);
  return new Promise((resolve, reject) => {
    // `timeout` below is only a socket-idle timeout; a slow drip could hold
    // the request open indefinitely, so also enforce a wall-clock deadline.
    const deadline = setTimeout(
      () => req.destroy(new Error("Nutrition site timed out")),
      TIMEOUT_MS
    );
    const fail = (err: Error) => {
      clearTimeout(deadline);
      reject(err);
    };
    const req = https.get(url, { agent, headers, timeout: TIMEOUT_MS }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy(new Error("Nutrition page too large"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        clearTimeout(deadline);
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") });
      });
      res.on("error", fail);
    });
    req.on("timeout", () => req.destroy(new Error("Nutrition site timed out")));
    req.on("error", fail);
  });
}
