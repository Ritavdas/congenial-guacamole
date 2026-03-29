import nextConfig from "eslint-config-next";
import security from "eslint-plugin-security";
import noSecrets from "eslint-plugin-no-secrets";

const eslintConfig = [
  ...nextConfig,
  {
    plugins: {
      security: security,
      "no-secrets": noSecrets,
    },
    rules: {
      "no-secrets/no-secrets": "error",
      "security/detect-object-injection": "off",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-unsafe-regex": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-possible-timing-attacks": "warn",
    },
  },
];

export default eslintConfig;
