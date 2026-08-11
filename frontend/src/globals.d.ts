/*
 * SEED CLI 스니펫(`src/seed-design/ui/*.tsx`)은 개발용 경고를 `process.env.NODE_ENV !== "production"`
 * 으로 감싼다. Vite가 번들 시 이 표현식을 리터럴로 치환하므로 런타임에는 문제가 없지만,
 * 타입 검사에는 선언이 필요하다.
 *
 * tsconfig의 `types`에 `"node"`를 통째로 넣지 않는 이유: 브라우저 코드에 Buffer·__dirname 같은
 * Node 전역이 전부 열려 잘못된 사용을 타입 검사가 잡지 못하게 된다. 실제로 쓰는 한 조각만 선언한다.
 */
declare const process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test'
  }
}
