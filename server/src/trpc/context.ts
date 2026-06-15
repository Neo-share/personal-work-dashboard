export type TrpcContext = Record<string, never>;

export function createContext(): TrpcContext {
  return {};
}
