/**
 * Public surface of the AI abstraction layer.
 *
 * All application code (routes, services) must import from here.
 * Never import from provider files directly.
 */

export { TaskType, TASK_ROUTING, TASK_DESCRIPTIONS, FALLBACK_PROVIDER } from "./tasks";
export type { ProviderName } from "./tasks";
export { aiRouter } from "./router";
export type { AIProvider, AIProviderResult, AITaskContext } from "./providers/interface";
export { stripCodeFences, parseModelJson } from "./providers/interface";
export { getProviderKey, getKeyStatus, invalidateKeyCache } from "./key-service";
