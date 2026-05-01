export {};

// getReactNativePersistence exists in the react-native bundle of @firebase/auth
// but is absent from the browser TypeScript types that firebase/auth resolves to.
declare module 'firebase/auth' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function getReactNativePersistence(storage: any): any;
}
