export interface GuardrailFinding {
  path: string;
  line: number;
  rule: string;
  text: string;
  msg: string;
}
export function isTestOrDemo(path: string): boolean;
export function scanContent(path: string, content: string): GuardrailFinding[];
export function run(files: string[]): GuardrailFinding[];
