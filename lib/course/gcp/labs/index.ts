/**
 * The hands-on labs of the GCP course: one lab per station, in study order.
 * Pure data and pure functions. The rules for writing a lab are in
 * `lib/course/gcp/README.md` > Hands-on labs.
 */

import { LABS as analysis } from '@/lib/course/gcp/labs/analysis';
import { LABS as design } from '@/lib/course/gcp/labs/design';
import { LABS as ingest } from '@/lib/course/gcp/labs/ingest';
import { LABS as operations } from '@/lib/course/gcp/labs/operations';
import { LABS as storage } from '@/lib/course/gcp/labs/storage';
import type { GcpLab, LabFile, LabStep } from '@/types/gcp';

export const LABS: readonly GcpLab[] = [
  ...design,
  ...ingest,
  ...storage,
  ...analysis,
  ...operations,
];

/** A lab is worth this much XP. Labs do not count toward exam readiness. */
export const LAB_XP = 50;

/** The progress id of a lab. Do not rename a station slug after release. */
export function labId(station: string): string {
  return `lab:${station}`;
}

export function getLab(station: string): GcpLab | undefined {
  return LABS.find((lab) => lab.station === station);
}

/** The Cloud Shell command that writes a file, so the learner needs no download. */
export function fileCommand(file: LabFile): string {
  return `cat > ${file.name} <<'EOF'\n${file.content}\nEOF`;
}

/** The first step of every lab: pick the project, set the variables, enable the APIs. */
export function setupStep(lab: GcpLab): LabStep {
  const vars = Object.entries(lab.vars ?? {}).map(([name, value]) => `export ${name}=${value}`);
  const shell = [
    '# Replace YOUR_PROJECT_ID with your project ID.',
    'gcloud config set project YOUR_PROJECT_ID',
    'export PROJECT_ID=$(gcloud config get-value project)',
    ...vars,
    `gcloud services enable ${lab.apis.join(' ')}`,
  ].join('\n');
  return {
    title: 'Set up your project and Cloud Shell',
    body: 'Use a project with billing turned on, ideally a new project for learning, so nothing here can touch real work. Every lab runs in «us-central1». If Cloud Shell reconnects or you open a new tab, run these lines again: the variables last only for one session.',
    concepts: [],
    console:
      '1. Open console.cloud.google.com and pick (or create) your learning project in the project picker.\n2. Click **Activate Cloud Shell** (the terminal icon at the top right). A terminal opens at the bottom of the page.\n3. Paste the commands from the **Cloud Shell** tab.',
    shell,
    check:
      '«gcloud services enable» ends with «Operation … finished successfully» (or prints nothing, when the APIs were already on).',
    see: 'The project picker at the top of the console shows your project. **APIs & Services** > **Enabled APIs & services** lists the APIs this lab needs. To turn one on without Cloud Shell, open **APIs & Services** > **Library**, search for it, and click **Enable**.',
  };
}

/** The step that writes the lab's sample files, or undefined when the lab makes its data in SQL. */
export function dataStep(lab: GcpLab): LabStep | undefined {
  if (lab.files.length === 0) return undefined;
  return {
    title: 'Create the sample data',
    body: 'Everything the lab needs is below. In Cloud Shell, paste the command for each file to write it in your home folder. To use the console instead, download each file and upload it when a step asks.',
    concepts: [],
    console:
      '1. Under **Sample files** in the briefing above, click each file to download it.\n2. Keep the files at hand: a step tells you when to upload one, in BigQuery with **Create table** > **Upload** or in Cloud Storage with **Upload files**.\n3. To write the files in Cloud Shell instead, paste the commands from the **Cloud Shell** tab.',
    shell: lab.files.map(fileCommand).join('\n\n'),
    check: `«ls» shows ${lab.files.map((file) => `«${file.name}»`).join(', ')}.`,
    see: 'In Cloud Shell, click **Open Editor** to see the files in your home folder. If you downloaded them, your browser’s downloads list shows each one.',
  };
}

/** Every step the learner ticks, in order: setup, data, the lab steps, then cleanup. */
export interface LabPlan {
  steps: readonly LabStep[];
  cleanup: readonly LabStep[];
}

export function labPlan(lab: GcpLab): LabPlan {
  const data = dataStep(lab);
  return {
    steps: [setupStep(lab), ...(data === undefined ? [] : [data]), ...lab.steps],
    cleanup: lab.cleanup,
  };
}

/** The tick ids of a lab's steps and cleanup steps, for the checklist state. */
export function tickIds(plan: LabPlan): { steps: string[]; cleanup: string[] } {
  return {
    steps: plan.steps.map((_, index) => `step-${index + 1}`),
    cleanup: plan.cleanup.map((_, index) => `cleanup-${index + 1}`),
  };
}
