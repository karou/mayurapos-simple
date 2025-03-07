// .eslintrc.js

module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      ecmaFeatures: {
        jsx: true
      },
      project: "./tsconfig.json"
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    extends: [
      "eslint:recommended",
      "plugin:react/recommended",
      "plugin:@typescript-eslint/recommended",
      "plugin:@typescript-eslint/recommended-requiring-type-checking",
      "prettier"
    ],
    rules: {
      // Fix for React no-unescaped-entities rule
      "react/no-unescaped-entities": [
        "error",
        {
          "forbid": [
            {
              "char": ">",
              "alternatives": ["&gt;"]
            },
            {
              "char": "}",
              "alternatives": ["&#125;"]
            }
          ]
        }
      ],
      
      // Better handling of Promise-related issues
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          "checksVoidReturn": {
            "attributes": false
          }
        }
      ],
      
      // Allow some any types in specific situations
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      
      // Additional useful TypeScript rules
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": "allow-with-description",
          "ts-expect-error": "allow-with-description",
          "minimumDescriptionLength": 10
        }
      ],
      
      // React specific rules
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/display-name": "off",
      "react/jsx-curly-brace-presence": ["error", "never"]
    },
    overrides: [
      {
        files: ["*.test.tsx", "*.test.ts", "*.spec.tsx", "*.spec.ts"],
        rules: {
          "@typescript-eslint/no-unsafe-assignment": "off",
          "@typescript-eslint/no-unsafe-member-access": "off",
          "@typescript-eslint/no-unsafe-call": "off",
          "@typescript-eslint/no-unsafe-return": "off",
          "@typescript-eslint/no-unsafe-argument": "off"
        }
      }
    ]
  };