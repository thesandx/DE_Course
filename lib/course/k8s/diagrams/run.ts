/**
 * Diagrams for ports 5 to 9: storage, health, security, network policies and
 * identity. Keyed by `<port>/<lesson>`. See lib/course/k8s/README.md > Diagrams.
 */

import type { K8sDiagram } from '@/types/k8s';

export const DIAGRAMS: Readonly<Record<string, K8sDiagram>> = {
  'storage/ephemeral-storage': {
    kind: 'spectrum',
    title: 'How long does the data live?',
    from: 'Lost soonest',
    to: 'Kept longest',
    stops: [
      {
        label: 'Container filesystem',
        note: 'Gone when the container restarts.',
        tone: 'hard',
      },
      {
        label: 'emptyDir volume',
        note: 'Survives a container restart. Gone with the pod.',
        tone: 'medium',
      },
      {
        label: 'PersistentVolumeClaim',
        note: 'Outlives every pod.',
        tone: 'easy',
      },
    ],
    caption:
      'A crash restarts the container with a clean filesystem. An «emptyDir» belongs to the pod, so containers in the pod can share it, but a deleted pod takes it away. Data you must keep needs a claim.',
  },
  'storage/persistent-volumes': {
    kind: 'flow',
    title: 'From a claim to a disk',
    steps: [
      { label: 'Pod', note: 'Mounts the claim by name.', tone: 'plain' },
      {
        label: 'PersistentVolumeClaim',
        note: 'Asks for a size and an access mode.',
        tone: 'brand',
        chips: ['1Gi', 'ReadWriteOnce'],
      },
      { label: 'StorageClass', note: 'Knows how to make a disk.', tone: 'iris' },
      { label: 'PersistentVolume', note: 'The real disk, bound to the claim.', tone: 'teal' },
    ],
    edges: ['uses', 'names', 'provisions'],
    caption:
      'The app asks for storage and never names a disk. With «WaitForFirstConsumer» the disk is made only when a pod uses the claim, so a claim that stays **Pending** with no pod is normal.',
  },
  'storage/statefulsets': {
    kind: 'pairs',
    title: 'Each replica keeps its name and its disk',
    left: 'Pod',
    right: 'Its own claim and DNS name',
    pairs: [
      ['pg-0', 'data-pg-0 · pg-0.pg.default.svc'],
      ['pg-1', 'data-pg-1 · pg-1.pg.default.svc'],
      ['pg-2', 'data-pg-2 · pg-2.pg.default.svc'],
    ],
    caption:
      'A Deployment gives pods random names and one shared claim. A StatefulSet starts pods in order, and a replaced «pg-1» comes back as «pg-1» with the same disk. Deleting the StatefulSet **keeps** the claims.',
  },

  'health/probes': {
    kind: 'compare',
    title: 'Three probes, three questions',
    columns: [
      {
        label: 'Startup',
        note: 'Has it finished starting?',
        tone: 'sky',
        points: ['Runs first', 'The other two wait for it', 'On failure: restart'],
      },
      {
        label: 'Readiness',
        note: 'Can it serve now?',
        tone: 'brand',
        points: [
          'Runs for the whole life',
          'On failure: out of the Service',
          'The container is not restarted',
        ],
      },
      {
        label: 'Liveness',
        note: 'Is it stuck?',
        tone: 'hard',
        points: ['Runs for the whole life', 'On failure: restart', 'Never check a dependency here'],
      },
    ],
    caption:
      'Readiness removes a pod from traffic and liveness restarts it. A liveness probe that checks the database turns one slow database into a restart storm of every pod.',
  },
  'health/requests-limits': {
    kind: 'compare',
    title: 'Requests and limits, CPU and memory',
    columns: [
      {
        label: 'Request',
        note: 'What the scheduler reserves',
        tone: 'brand',
        points: [
          'A pod fits a node only if its requests fit',
          'Too high: pods stay Pending',
          'Too low: noisy neighbours',
        ],
      },
      {
        label: 'CPU limit',
        note: 'Above it: throttled',
        tone: 'medium',
        points: ['The container slows down', 'It is never killed for CPU'],
      },
      {
        label: 'Memory limit',
        note: 'Above it: OOMKilled',
        tone: 'hard',
        points: ['Exit code 137', 'The container restarts'],
      },
    ],
    caption:
      'The scheduler reads **requests** and ignores real usage. CPU can be squeezed, so a CPU limit throttles. Memory cannot, so a memory limit kills.',
  },
  'health/hpa': {
    kind: 'flow',
    title: 'The autoscaler loop',
    steps: [
      { label: 'metrics-server', note: 'Reads CPU from every kubelet.', tone: 'sky' },
      {
        label: 'HPA',
        note: 'Compares usage with the target, every 15 seconds.',
        tone: 'brand',
        chips: ['target 50%', 'min 2', 'max 8'],
      },
      { label: 'Deployment', note: 'Gets a new «replicas» value.', tone: 'iris' },
      { label: 'Pods', note: 'More pods share the load.', tone: 'teal' },
    ],
    edges: ['usage', 'scale', 'create'],
    caption:
      'The target is a percent of the CPU **request**, so an HPA does nothing for a pod with no request. Scale-up is fast and scale-down waits five minutes to avoid flapping.',
  },
  'health/pending-and-disruptions': {
    kind: 'flow',
    title: 'Two autoscalers work together',
    steps: [
      { label: 'Load rises', note: 'The HPA adds pods.', tone: 'plain' },
      { label: 'Pods are Pending', note: 'No node has room for the requests.', tone: 'medium' },
      { label: 'Node autoscaler', note: 'Sees Pending pods and adds a node.', tone: 'brand' },
      { label: 'Pods are scheduled', note: 'The new node takes them.', tone: 'easy' },
    ],
    edges: ['no room', 'triggers', 'fits'],
    caption:
      'The HPA adds pods; the node autoscaler adds machines. When it removes a node it drains the pods, and a **PodDisruptionBudget** makes it leave enough replicas running.',
  },

  'security/rbac': {
    kind: 'flow',
    title: 'Who can do what, where',
    steps: [
      {
        label: 'Subject',
        note: 'A user, a group or a ServiceAccount.',
        tone: 'sky',
        chips: ['ServiceAccount: ci-bot'],
      },
      { label: 'RoleBinding', note: 'Joins a subject to a role, in one namespace.', tone: 'brand' },
      {
        label: 'Role',
        note: 'A list of verbs on resources.',
        tone: 'iris',
        chips: ['get', 'list', 'pods'],
      },
    ],
    edges: ['bound by', 'grants'],
    caption:
      'RBAC only adds permissions. Nothing is allowed until a binding grants it, and there is no deny rule. A **ClusterRole** bound with a RoleBinding still grants inside one namespace only.',
  },
  'security/pod-security': {
    kind: 'spectrum',
    title: 'Pod Security Standards',
    from: 'Anything goes',
    to: 'Hardened',
    stops: [
      { label: 'privileged', note: 'No checks. For system pods.', tone: 'hard' },
      {
        label: 'baseline',
        note: 'Blocks the known escapes: host network, privileged mode.',
        tone: 'medium',
      },
      {
        label: 'restricted',
        note: 'Also needs non-root, no privilege escalation, dropped capabilities.',
        tone: 'easy',
        chips: ['runAsNonRoot', 'drop: ALL'],
      },
    ],
    caption:
      'A label on the namespace picks the level, and **Pod Security Admission** rejects a pod that does not meet it. The «securityContext» in the pod is how you meet it.',
  },

  'netpol/flat-network': {
    kind: 'compare',
    title: 'Before and after a NetworkPolicy',
    columns: [
      {
        label: 'No policy',
        note: 'The default',
        tone: 'hard',
        points: [
          'Every pod reaches every pod',
          'Namespaces do not block traffic',
          'One broken pod can reach the database',
        ],
      },
      {
        label: 'A policy selects the pod',
        note: 'Allow list',
        tone: 'easy',
        points: [
          'Only the listed traffic gets in',
          'Rules select pods by label',
          'The network plugin enforces them',
        ],
      },
    ],
    caption:
      'A namespace is a folder for names, not a firewall. A NetworkPolicy does nothing unless the cluster’s **network plugin** enforces it; the API accepts it either way.',
  },
  'netpol/default-deny': {
    kind: 'boundary',
    title: 'Default deny, then one door',
    inside: {
      label: 'Namespace with default-deny ingress',
      boxes: [
        { label: 'postgres', note: 'Allows only «app=tugboat» on 5432.', tone: 'iris' },
        { label: 'tugboat', note: 'Carries the label the rule names.', tone: 'brand' },
      ],
    },
    outside: [
      { label: 'tugboat to postgres', note: 'Matches the allow rule.', verdict: 'allowed' },
      { label: 'debug pod to postgres', note: 'No rule names it.', verdict: 'blocked' },
      { label: 'Pod in another namespace', note: 'No rule names it.', verdict: 'blocked' },
    ],
    caption:
      'Policies add up: a pod accepts the union of every rule that selects it. So you first select every pod with an empty rule list, then add one small allow rule for each real path.',
  },
  'netpol/egress-dns': {
    kind: 'flow',
    title: 'Why default-deny egress breaks everything',
    steps: [
      { label: 'tugboat', note: 'Wants to call «postgres:5432».', tone: 'plain' },
      {
        label: 'DNS lookup',
        note: 'Goes to kube-dns in «kube-system», on port 53.',
        tone: 'hard',
        chips: ['UDP 53', 'TCP 53'],
      },
      { label: 'Connect', note: 'Only now does the app use the IP.', tone: 'easy' },
    ],
    edges: ['first', 'then'],
    caption:
      'A blocked lookup looks like a timeout on the name, not a refused connection. Allow egress to **kube-dns on port 53, UDP and TCP**, before you allow anything else.',
  },

  'identity/serviceaccount-tokens': {
    kind: 'flow',
    title: 'How a pod proves who it is',
    steps: [
      {
        label: 'Pod',
        note: 'Runs as one ServiceAccount.',
        tone: 'plain',
        chips: ['serviceAccountName'],
      },
      {
        label: 'kubelet',
        note: 'Asks for a token and mounts it as a file.',
        tone: 'sky',
        chips: ['expires in 1 hour', 'rotated'],
      },
      {
        label: 'API server',
        note: 'Checks the signature, the audience and the expiry.',
        tone: 'brand',
      },
      { label: 'RBAC', note: 'Decides what that account may do.', tone: 'iris' },
    ],
    edges: ['starts', 'Bearer token', 'who is it'],
    caption:
      'The token is short-lived and bound to the pod: it stops working when the pod is deleted. The token proves **who**; RBAC decides **what**. The «default» account has no permissions worth using, so give each app its own.',
  },
  'identity/workload-identity': {
    kind: 'compare',
    title: 'A key file or Workload Identity',
    columns: [
      {
        label: 'Service account key',
        note: 'A JSON file in a Secret',
        tone: 'hard',
        points: ['Valid for years', 'Works from anywhere once copied', 'Someone must rotate it'],
      },
      {
        label: 'Workload Identity Federation',
        note: 'IAM trusts the Kubernetes ServiceAccount',
        tone: 'easy',
        points: [
          'Tokens live for about an hour',
          'Only this pod identity can get one',
          'Nothing to store or rotate',
        ],
      },
    ],
    caption:
      'The pod calls the GKE metadata server and gets a short-lived Google token for its own ServiceAccount. You grant the IAM role to that account directly: no key exists to leak.',
  },
};
