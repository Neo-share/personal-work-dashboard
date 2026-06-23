import { PersonalToolRegistry } from '../tool-registry.js';
import { recurringCreateTool, recurringMaterializeTool } from './recurring-tools.js';
import { scheduleCreateLocalTool } from './schedule-tools.js';
import { todoCreateTool, todoReviseAiTool } from './todo-tools.js';

/** 注册个人助手全部白名单工具（F0 契约） */
export function registerPersonalTools(registry: PersonalToolRegistry): void {
  registry.register(todoCreateTool);
  registry.register(todoReviseAiTool);
  registry.register(scheduleCreateLocalTool);
  registry.register(recurringCreateTool);
  registry.register(recurringMaterializeTool);
}

let sharedRegistry: PersonalToolRegistry | null = null;

/** 单例工具注册表，供 orchestrator 复用 */
export function getPersonalToolRegistry(): PersonalToolRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new PersonalToolRegistry();
    registerPersonalTools(sharedRegistry);
  }
  return sharedRegistry;
}
