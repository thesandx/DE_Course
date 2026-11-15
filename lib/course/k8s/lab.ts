/**
 * Small helpers for the lab steps of the Kubernetes course. Pure.
 */

import type { K8sFile, K8sLabStep, K8sLesson, K8sPort } from '@/types/k8s';

/** The root folder of the learner's lab files. Every port has a folder under it. */
export const LAB_ROOT = '~/kube-quest';

/**
 * The command that writes one lesson file into the port's folder. The heredoc
 * is quoted, so the shell pastes the file as it is and expands nothing.
 */
export function fileCommand(port: Pick<K8sPort, 'dir'>, file: K8sFile): string {
  const slash = file.name.lastIndexOf('/');
  const sub = slash >= 0 ? `/${file.name.slice(0, slash)}` : '';
  return [
    `mkdir -p ${LAB_ROOT}/${port.dir}${sub} && cd ${LAB_ROOT}/${port.dir}`,
    `cat <<'EOF' > ${file.name}`,
    file.code,
    'EOF',
  ].join('\n');
}

/** The file a step writes, or undefined when the step runs commands. */
export function stepFile(lesson: K8sLesson, step: K8sLabStep): K8sFile | undefined {
  return step.file === undefined ? undefined : lesson.files.find((file) => file.name === step.file);
}

/** Where a step runs: the label on its code block. */
export function stepPlace(step: K8sLabStep): string {
  if (step.cloud === true) return 'Cloud Shell, or WSL with gcloud';
  if (step.windowsFile === true) return 'Windows · .wslconfig';
  if (step.secondTerminal === true) return 'Terminal 2';
  return 'Terminal';
}

/** The tick id of a lab step. Stable while the lesson keeps its step order. */
export function stepTick(index: number): string {
  return `step-${index + 1}`;
}

/** The tick ids of a mission: one per task, then the cleanup. */
export function missionTicks(port: K8sPort): { tasks: string[]; cleanup: string } {
  return {
    tasks: port.mission.tasks.map((_, index) => `task-${index + 1}`),
    cleanup: 'cleanup',
  };
}
