declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_WEB_URL?: string;
  }
}

declare const process: { env: NodeJS.ProcessEnv };
