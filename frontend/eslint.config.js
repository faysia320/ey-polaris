import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn/ui 생성 컴포넌트는 variants 상수를 함께 export하는 것이 표준 패턴
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // SEED CLI(`npx @seed-design/cli add ...`)가 내려받는 스니펫.
    // 손으로 고쳐도 다음 add/upgrade 때 덮어써지므로 생성 코드의 관용구를 그대로 통과시킨다.
    // - no-empty-object-type: `interface ActionButtonProps extends SeedActionButtonProps {}`
    //   빈 인터페이스는 스니펫을 확장할 자리를 열어두는 SEED의 규약이다.
    files: ['src/seed-design/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
