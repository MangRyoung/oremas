/* 안 쓰는 이름 · 덮어쓰는 선언 찾기 — npx eslint@9 js (코드 지침은 CLAUDE.md) */
module.exports = [
  { ignores: ["js/battle_ui/**", "js/maker/**", "js/vendor/**", "**/readymade.js", "**/states.js", "data/**", "logtool/**", "sim/data/**", "sim/records/**", "sim/report/**"] },
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "script" },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", vars: "local" }],
      "no-redeclare": "warn",
      "no-dupe-keys": "warn",
      "no-func-assign": "warn",
      "no-unreachable": "warn"
    }
  }
];
