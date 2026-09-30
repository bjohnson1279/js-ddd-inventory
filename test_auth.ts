import { decryptSymmetric } from "./src/infrastructure/utils/security";

const badCipher = "foo";
try {
  const dec = decryptSymmetric(badCipher);
  console.log("Decrypted bad cipher:", dec);
} catch (e) {
  console.log("Caught:", e);
}
