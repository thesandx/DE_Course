/**
 * The Kubernetes course's shape. The course is a voyage: the learner takes
 * one image, tugboat, through a list of ports. Each port is a module, and
 * each lesson at a port goes from a production problem to the Kubernetes
 * object that fixes it, then to a lab on a local kind cluster.
 *
 * The content lives in `lib/course/k8s/`. Prose fields use the course
 * Markdown dialect (`lib/course/markdown.ts`); short fields such as a prompt
 * or an option use its inline markers only.
 */

import type { ChoiceQuestion, CourseDiagram, StationCheck } from '@/types/gcp';

/** A file the learner writes in a lab, with notes on the lines that matter. */
export interface K8sFile {
  /** The path inside the port's folder, such as "deploy.yaml" or "base/kustomization.yaml". */
  name: string;
  code: string;
  /** A fragment of a line, then what that line does. Inline markers only. */
  notes: ReadonlyArray<readonly [string, string]>;
  /** True for a long file that the page shows closed. */
  collapsed?: boolean;
}

/** One step of a lesson's lab. */
export interface K8sLabStep {
  /** What to do and why. Inline markers only. */
  text: string;
  /** The name of a lesson file. The step writes that file with a heredoc. */
  file?: string;
  /** Commands to paste. Plain text. */
  code?: string;
  /** What the terminal prints when the step worked. Plain text. */
  output?: string;
  /** The learner predicts the result before they run the step. */
  predict?: ChoiceQuestion;
  /** The step runs in a second terminal, beside a watch in the first. */
  secondTerminal?: boolean;
  /** The step opens a page in the browser. */
  browser?: boolean;
  /** The step breaks something on purpose. */
  breakIt?: boolean;
  /** The step runs against Google Cloud and can cost money. */
  cloud?: boolean;
  /** The code is the content of a Windows settings file, not a command. */
  windowsFile?: boolean;
}

/** The interactive models a lesson can show. Each one is a component in `components/k8s/sims/`. */
export type SimId =
  'loop' | 'rollout' | 'selector' | 'probes' | 'resources' | 'autoscale' | 'rbac' | 'netpol';

export interface K8sLesson {
  slug: string;
  title: string;
  /** The production problem that opens the lesson. Inline markers only. */
  pain: string;
  /** The Kubernetes object that fixes it. Inline markers only. */
  fix: string;
  /** The explanation. Course Markdown dialect. */
  body: string;
  /** A correction of a common wrong idea. Inline markers only. */
  note?: string;
  /** What the learner knows from Docker, and its Kubernetes match. */
  docker?: ReadonlyArray<readonly [string, string]>;
  files: readonly K8sFile[];
  sim?: SimId;
  lab: readonly K8sLabStep[];
  /** The lesson counts once every check is right. */
  checks: readonly StationCheck[];
}

/** The task at the end of a port: the learner combines the lessons with no steps given. */
export interface K8sMission {
  title: string;
  brief: string;
  /** Inline markers only. */
  tasks: readonly string[];
  hint?: string;
  /** One way to do it. Plain text for a terminal. */
  solution: string;
}

export interface K8sPort {
  slug: string;
  /** The position on the route, from 0. */
  number: number;
  title: string;
  /** A short line under the title. */
  tag: string;
  /** Which `--color-track-*` hue the port uses. */
  hue: number;
  /** The folder under `~/kube-quest/` that holds the port's files. */
  dir: string;
  /** The day at work that frames the port. */
  story: string;
  lessons: readonly K8sLesson[];
  mission: K8sMission;
  /** Commands that delete what the port created. Plain text. */
  cleanup: string;
}

/** A failure as the pager shows it. The learner reads the output and picks the cause. */
export interface Incident extends ChoiceQuestion {
  /** The port slug. */
  port: string;
  title: string;
  /** The terminal output to read. Plain text. */
  code: string;
}

export interface K8sCard {
  /** The port slug. */
  port: string;
  front: string;
  back: string;
}

/** A command to type from memory. */
export interface DojoTask {
  task: string;
  /** One command that does it. */
  answer: string;
  /** Regular expressions. A typed command is right when it matches every one. */
  need: readonly string[];
  /** What the terminal prints. Plain text. */
  output: string;
}

export interface RosettaRow {
  docker: string;
  kubernetes: string;
  note: string;
}

export interface CheatGroup {
  group: string;
  items: ReadonlyArray<{ command: string; does: string }>;
}

/** A picture that explains one lesson. The lesson page shows it above the text. */
export type K8sDiagram = CourseDiagram;
