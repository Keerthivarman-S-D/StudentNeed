/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_COLLEGE_EMAIL_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
