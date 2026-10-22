// @vitest-environment node
import { describe, expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
import {
  INCOMMON_ECC_OV_SSL_CA_3,
  assertNutritionUrl,
} from "../nutritionHttps.helpers";

describe("nutritionHttps.helpers", () => {
  it("bundles the InCommon ECC OV SSL CA 3 intermediate", () => {
    const cert = new X509Certificate(INCOMMON_ECC_OV_SSL_CA_3);
    expect(cert.subject).toContain("CN=InCommon ECC OV SSL CA 3");
    expect(cert.issuer).toContain("CN=Sectigo Public Server Authentication Root E46");
    expect(cert.fingerprint256).toBe(
      "22:7B:61:E5:3F:13:1C:EF:CB:81:E8:89:9E:D9:82:9F:7E:78:05:86:64:7F:3F:98:DF:2A:BE:C2:16:7F:40:5B"
    );
  });

  it("only allows https URLs on the nutrition host", () => {
    expect(
      assertNutritionUrl("https://nutrition.sa.ucsc.edu/shortmenu.aspx?x=1").hostname
    ).toBe("nutrition.sa.ucsc.edu");
    expect(() => assertNutritionUrl("http://nutrition.sa.ucsc.edu/")).toThrow();
    expect(() => assertNutritionUrl("https://evil.example/")).toThrow();
    expect(() => assertNutritionUrl("https://nutrition.sa.ucsc.edu.evil.example/")).toThrow();
    expect(() => assertNutritionUrl("not a url")).toThrow();
  });
});
