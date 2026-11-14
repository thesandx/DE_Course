/**
 * Diagrams for ports 10 to 13: GitOps, Helm, data platforms and the capstone.
 * Keyed by `<port>/<lesson>`. See lib/course/k8s/README.md > Diagrams.
 */

import type { K8sDiagram } from '@/types/k8s';

export const DIAGRAMS: Readonly<Record<string, K8sDiagram>> = {
  'gitops/why-gitops': {
    kind: 'compare',
    title: 'Push from CI or pull from Git',
    columns: [
      {
        label: 'CI runs kubectl',
        note: 'Push',
        tone: 'hard',
        points: [
          'CI holds cluster admin credentials',
          'A manual change stays until someone sees it',
          'Git and the cluster drift apart',
        ],
      },
      {
        label: 'An agent in the cluster',
        note: 'Pull',
        tone: 'easy',
        points: [
          'The cluster reads Git; nothing outside holds a key',
          'A manual change is reverted',
          'A rollback is «git revert»',
        ],
      },
    ],
    caption:
      'GitOps is the control loop one level up: Git is the desired state and an agent makes the cluster match it. The history of the cluster is the history of the repository.',
  },
  'gitops/argo-cd': {
    kind: 'flow',
    title: 'What one Application does',
    steps: [
      { label: 'Git repository', note: 'The manifests, at a path and a revision.', tone: 'iris' },
      {
        label: 'Argo CD',
        note: 'Renders the manifests and compares them with the cluster.',
        tone: 'brand',
        chips: ['Synced', 'OutOfSync'],
      },
      { label: 'Cluster', note: 'Receives the difference only.', tone: 'teal' },
    ],
    edges: ['pull', 'apply'],
    fork: {
      label: 'Automated sync options',
      boxes: [
        { label: 'selfHeal', note: 'Reverts a manual change.', tone: 'easy' },
        { label: 'prune', note: 'Deletes what left Git.', tone: 'medium' },
      ],
    },
    caption:
      'Two states matter: **Synced** means the cluster matches Git, and **Healthy** means the objects work. An app can be Synced and Degraded: Git holds a bad image tag.',
  },
  'gitops/promotion-secrets': {
    kind: 'flow',
    title: 'Promote with a pull request',
    steps: [
      { label: 'CI builds the image', note: 'And tags it with the commit.', tone: 'plain' },
      { label: 'PR to envs/dev', note: 'Changes one image tag.', tone: 'sky' },
      { label: 'PR to envs/staging', note: 'The same tag, after tests.', tone: 'iris' },
      { label: 'PR to envs/prod', note: 'The same tag, after review.', tone: 'brand' },
    ],
    edges: ['bump', 'promote', 'promote'],
    caption:
      'Use a **folder per environment**, not a branch per environment: a diff between folders is easy to read. Secrets stay out of Git; **External Secrets** copies them from a secret manager into the cluster.',
  },

  'helm/helm-basics': {
    kind: 'flow',
    title: 'Chart + values = release',
    steps: [
      { label: 'Chart', note: 'A versioned package of templates.', tone: 'iris' },
      {
        label: 'Values',
        note: 'Your settings for this install.',
        tone: 'sky',
        chips: ['--set', '-f values.yaml'],
      },
      { label: 'helm install', note: 'Renders plain YAML and applies it.', tone: 'brand' },
      {
        label: 'Release',
        note: 'A named install with numbered revisions.',
        tone: 'easy',
        chips: ['revision 1', 'revision 2'],
      },
    ],
    edges: ['plus', 'render', 'record'],
    caption:
      'Helm stores each revision as a Secret in the namespace, so «helm rollback» can go back to any of them. «helm template» shows the YAML without touching the cluster: run it first.',
  },
  'helm/own-chart': {
    kind: 'layers',
    title: 'The parts of a chart',
    layers: [
      { label: 'Chart.yaml', note: 'Name, chart version and app version.', tone: 'plain' },
      { label: 'values.yaml', note: 'The defaults. Each team overrides a few.', tone: 'brand' },
      {
        label: 'templates/',
        note: 'Manifests with placeholders that read the values.',
        tone: 'iris',
        chips: ['.Values.replicas', '.Release.Name'],
      },
      { label: '_helpers.tpl', note: 'Named snippets, such as the labels.', tone: 'sky' },
    ],
    caption:
      'A good chart needs no override to install. Expose only the settings teams really change; every value you add is one more thing to test and to document.',
  },
  'helm/helm-or-kustomize': {
    kind: 'decision',
    title: 'Helm or Kustomize?',
    questions: [
      {
        ask: 'Do other teams or companies install it?',
        yes: { label: 'Helm chart', note: 'A package with a version and settings.', tone: 'iris' },
      },
      {
        ask: 'Is it someone else’s chart that needs one small change?',
        yes: {
          label: 'Helm, then a Kustomize patch',
          note: 'Render the chart and patch the output.',
          tone: 'sky',
        },
      },
    ],
    otherwise: {
      label: 'Kustomize',
      note: 'Your own manifests, one overlay per environment.',
      tone: 'brand',
    },
    caption:
      'Helm templates text; Kustomize patches YAML. In GitOps, Argo CD renders both, so Git still holds the single source and nobody runs «helm install» by hand.',
  },

  'data/operators-crds': {
    kind: 'flow',
    title: 'An operator is a control loop you install',
    steps: [
      {
        label: 'CRD',
        note: 'Adds a new kind to the API.',
        tone: 'iris',
        chips: ['SparkApplication'],
      },
      { label: 'Custom resource', note: 'Your object of that kind.', tone: 'brand' },
      { label: 'Operator', note: 'A controller pod that watches that kind.', tone: 'sky' },
      {
        label: 'Built-in objects',
        note: 'The pods, Services and ConfigMaps it creates.',
        tone: 'teal',
      },
    ],
    edges: ['allows', 'watched by', 'creates'],
    caption:
      'A CRD alone stores data and does nothing. The **operator** gives it behaviour. When a custom resource sits with an empty status, check that the operator pod runs and read its logs.',
  },
  'data/spark-on-kubernetes': {
    kind: 'flow',
    title: 'One Spark job on Kubernetes',
    steps: [
      { label: 'SparkApplication', note: 'Or «spark-submit --master k8s://».', tone: 'plain' },
      {
        label: 'Driver pod',
        note: 'Runs your code and plans the job.',
        tone: 'brand',
        chips: ['needs a ServiceAccount'],
      },
      { label: 'API server', note: 'The driver asks it for pods.', tone: 'sky' },
    ],
    edges: ['creates', 'create pods'],
    fork: {
      label: 'Executor pods, gone when the job ends',
      boxes: [
        { label: 'Executor 1', tone: 'teal' },
        { label: 'Executor 2', tone: 'teal' },
        { label: 'Executor 3', tone: 'teal' },
      ],
    },
    caption:
      'There is no standing Spark cluster: each job brings its own. The driver’s ServiceAccount needs RBAC to create pods, and a driver that is evicted loses the whole job, so keep it off spot nodes.',
  },
  'data/airflow-on-kubernetes': {
    kind: 'compare',
    title: 'Two ways Airflow uses pods',
    columns: [
      {
        label: 'KubernetesExecutor',
        note: 'How every task runs',
        tone: 'brand',
        points: [
          'One pod per task, then it leaves',
          'The pod runs the Airflow image',
          'No idle workers to pay for',
        ],
      },
      {
        label: 'KubernetesPodOperator',
        note: 'One kind of task',
        tone: 'iris',
        points: [
          'Runs any image you name',
          'The task brings its own dependencies',
          'Works with every executor',
        ],
      },
    ],
    caption:
      'The executor decides **where tasks run**; the operator decides **what one task runs**. A pod per task costs a start-up delay of some seconds, so very short tasks feel slow.',
  },
  'data/batch-scheduling': {
    kind: 'compare',
    title: 'Three guards that keep batch away from serving',
    columns: [
      {
        label: 'Taint + toleration',
        note: 'Where it runs',
        tone: 'iris',
        points: [
          'The batch pool repels every pod',
          'Only batch pods tolerate it',
          'A node selector sends them there',
        ],
      },
      {
        label: 'PriorityClass',
        note: 'Who waits',
        tone: 'brand',
        points: [
          'Batch gets a low priority',
          'Serving preempts batch when nodes fill',
          'Never the other way round',
        ],
      },
      {
        label: 'ResourceQuota',
        note: 'How much',
        tone: 'teal',
        points: [
          'A cap for each team namespace',
          'One job cannot take the cluster',
          'Pods must set requests',
        ],
      },
    ],
    caption:
      'A taint only keeps other pods **out**. To keep batch pods **in** the pool you also need a node selector or node affinity. A toleration alone lets them land anywhere.',
  },

  'capstone/fleet': {
    kind: 'hub',
    title: 'The fleet namespace',
    center: {
      label: 'tugboat',
      note: 'Deployment with probes, requests, an HPA and a PDB.',
      tone: 'brand',
    },
    spokes: [
      { label: 'Gateway + HTTPRoute', note: 'The way in from outside.', tone: 'sky' },
      { label: 'pg StatefulSet', note: 'Postgres with its own disk.', tone: 'iris' },
      { label: 'ingest CronJob', note: 'Loads rows on a schedule.', tone: 'teal' },
      { label: 'ConfigMap + Secret', note: 'Config and the database password.', tone: 'gold' },
      { label: 'NetworkPolicies', note: 'Default deny, then the real paths.', tone: 'hard' },
      {
        label: 'ServiceAccount + RBAC',
        note: 'Least privilege for each workload.',
        tone: 'medium',
      },
    ],
    caption:
      'Every object here comes from an earlier port. The chaos drills prove that they work together: delete a pod, drain a node, break the config, and watch the system heal.',
  },
  'capstone/gke': {
    kind: 'pairs',
    title: 'What changes from kind to GKE Autopilot',
    left: 'On kind',
    right: 'On GKE Autopilot',
    pairs: [
      ['kind load docker-image', 'Push to Artifact Registry'],
      ['Three node containers', 'Nodes appear for your pod requests'],
      ['cloud-provider-kind', 'A real Google load balancer'],
      ['standard StorageClass', 'Persistent Disk'],
      ['Free', 'You pay for pod requests: clean up'],
    ],
    caption:
      'The manifests stay the same; only the image path and a few class names change. That is the point of the API. Delete the cluster when you finish: a load balancer and disks keep costing money.',
  },
};
