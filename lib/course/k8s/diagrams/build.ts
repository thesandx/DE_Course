/**
 * Diagrams for ports 0 to 4: setup, fundamentals, workloads, networking and
 * config. Keyed by `<port>/<lesson>`. See lib/course/k8s/README.md > Diagrams.
 */

import type { K8sDiagram } from '@/types/k8s';

export const DIAGRAMS: Readonly<Record<string, K8sDiagram>> = {
  'setup/engine-room': {
    kind: 'layers',
    title: 'What runs inside what on your laptop',
    nested: true,
    rail: 'Each layer runs inside the one above',
    layers: [
      { label: 'Windows', note: 'Your browser and Docker Desktop.', tone: 'plain' },
      { label: 'WSL 2', note: 'The Linux terminal where you type.', tone: 'sky' },
      { label: 'Docker engine', note: 'Runs containers for WSL.', tone: 'teal' },
      {
        label: 'kind node containers',
        note: 'Each Kubernetes node is one Docker container.',
        tone: 'iris',
      },
      { label: 'Your pods', note: 'Containers inside the node containers.', tone: 'brand' },
    ],
    caption:
      'kind means Kubernetes in Docker. A node is a container, so a cluster costs you nothing and starts in a minute. If Docker is not healthy, nothing above it works: check it first.',
  },
  'setup/tools': {
    kind: 'compare',
    title: 'Two tools, two jobs',
    columns: [
      {
        label: 'kind',
        note: 'Builds the cluster',
        tone: 'iris',
        points: [
          'Creates and deletes local clusters',
          'Loads a local image into the nodes',
          'You use it a few times',
        ],
        chips: ['kind create cluster', 'kind load docker-image'],
      },
      {
        label: 'kubectl',
        note: 'Talks to the cluster',
        tone: 'brand',
        points: [
          'Sends requests to the API server',
          'Works the same on kind and on GKE',
          'You use it all day',
        ],
        chips: ['kubectl get', 'kubectl apply'],
      },
    ],
    caption:
      'kind is the shipyard and kubectl is the remote control. kubectl reads «~/.kube/config» to know which cluster to talk to, so the same commands work on any cluster.',
  },
  'setup/kind-cluster': {
    kind: 'hub',
    title: 'One control plane, two workers',
    center: {
      label: 'kq-control-plane',
      note: 'API server, etcd, scheduler and controllers.',
      tone: 'iris',
      chips: ['port 30080 mapped to your laptop'],
    },
    spokes: [
      { label: 'kq-worker', note: 'kubelet + containerd. Runs your pods.', tone: 'teal' },
      { label: 'kq-worker2', note: 'A second node, so you can see spreading.', tone: 'teal' },
      { label: 'kubectl', note: 'You, from the WSL terminal.', tone: 'brand' },
    ],
    caption:
      'Three Docker containers act as three nodes. Everything goes through the API server on the control plane. The port mapping is fixed when the cluster is created, so the config file sets it now.',
  },
  'setup/tugboat-image': {
    kind: 'flow',
    title: 'From source to a pod on kind',
    steps: [
      { label: 'app.py + Dockerfile', note: 'A small Python web app.', tone: 'plain' },
      { label: 'docker build', note: 'Makes «tugboat:v1» on your laptop.', tone: 'sky' },
      { label: 'kind load', note: 'Copies the image into every node.', tone: 'iris' },
      { label: 'Pod runs it', note: 'With «imagePullPolicy: IfNotPresent».', tone: 'brand' },
    ],
    edges: ['build', 'load', 'schedule'],
    caption:
      'A kind node has its own image store and cannot see the images in your Docker. Without **kind load** the pod tries a registry and fails with «ErrImagePull».',
  },

  'fundamentals/why-kubernetes': {
    kind: 'flow',
    title: 'The control loop',
    steps: [
      { label: 'Desired state', note: 'What you declared: 3 replicas.', tone: 'brand' },
      { label: 'Observe', note: 'A controller reads the real state: 2.', tone: 'sky' },
      { label: 'Diff', note: 'One is missing.', tone: 'medium' },
      { label: 'Act', note: 'Create one pod. Then observe again.', tone: 'easy' },
    ],
    edges: ['watch', 'compare', 'fix'],
    caption:
      'Docker runs what you tell it once. Kubernetes keeps comparing what you asked for with what exists, and fixes the difference. Every controller in this course is this loop.',
  },
  'fundamentals/first-pod': {
    kind: 'layers',
    title: 'What a Pod holds',
    nested: true,
    layers: [
      { label: 'Node', note: 'One machine. All containers of a pod land here.', tone: 'plain' },
      {
        label: 'Pod',
        note: 'One IP address, one network namespace, shared volumes.',
        tone: 'iris',
        chips: ['10.244.1.7'],
      },
      {
        label: 'Containers',
        note: 'Reach each other on «localhost».',
        tone: 'brand',
        chips: ['tugboat', 'optional sidecar'],
      },
    ],
    caption:
      'A Pod is the smallest unit Kubernetes schedules. Its containers share an IP and volumes and always move together. Most pods hold one container.',
  },
  'fundamentals/crash-vs-delete': {
    kind: 'compare',
    title: 'Who heals what',
    columns: [
      {
        label: 'Container crashes',
        note: 'The kubelet restarts it',
        tone: 'easy',
        points: [
          'Same pod, same name, same IP',
          'RESTARTS counts up',
          'The wait grows: CrashLoopBackOff',
        ],
      },
      {
        label: 'Pod is deleted',
        note: 'Nothing brings it back',
        tone: 'hard',
        points: ['A bare pod has no owner', 'The same holds when its node dies', 'It is gone'],
      },
      {
        label: 'Pod owned by a Deployment',
        note: 'A controller replaces it',
        tone: 'brand',
        points: ['New pod, new name, new IP', 'Works for a dead node too', 'Next port'],
      },
    ],
    caption:
      '«restartPolicy» heals a container inside a pod. It does not recreate a pod. Only a controller that owns the pod does that, which is why you almost never run bare pods.',
  },
  'fundamentals/declarative-yaml': {
    kind: 'layers',
    title: 'The four parts of every manifest',
    layers: [
      {
        label: 'apiVersion',
        note: 'Which API group and version.',
        tone: 'sky',
        chips: ['v1', 'apps/v1'],
      },
      { label: 'kind', note: 'Which type of object.', tone: 'teal', chips: ['Pod', 'Deployment'] },
      {
        label: 'metadata',
        note: 'Name, namespace and labels.',
        tone: 'iris',
        chips: ['name', 'labels'],
      },
      { label: 'spec', note: 'The desired state. You write this.', tone: 'brand' },
      { label: 'status', note: 'The real state. The cluster writes this.', tone: 'plain' },
    ],
    caption:
      'You write «spec», the cluster writes «status», and controllers work to make them match. «kubectl apply» sends the whole file again each time; only the difference changes.',
  },

  'workloads/deployments': {
    kind: 'layers',
    title: 'Deployment, ReplicaSet, Pods',
    nested: true,
    rail: 'Each object owns the one below',
    layers: [
      { label: 'Deployment', note: 'You edit this. It manages rollouts.', tone: 'brand' },
      {
        label: 'ReplicaSet',
        note: 'Keeps N pods that match the selector.',
        tone: 'iris',
        chips: ['replicas: 3'],
      },
      {
        label: 'Pods',
        note: 'Replaced when one disappears.',
        tone: 'teal',
        chips: ['app=tugboat', 'app=tugboat', 'app=tugboat'],
      },
    ],
    caption:
      'The ReplicaSet counts the pods that carry its labels and creates or deletes pods to reach the number. The selector must match the labels in the pod template, or the API rejects the Deployment.',
  },
  'workloads/rolling-updates': {
    kind: 'timeline',
    title: 'A rolling update of 3 replicas',
    axis: { start: 'apply v2', end: 'done' },
    lanes: [
      {
        label: 'Old ReplicaSet (v1)',
        spans: [
          { start: 0, end: 35, label: '3 pods', tone: 'plain' },
          { start: 35, end: 60, label: '2', tone: 'plain' },
          { start: 60, end: 85, label: '1', tone: 'plain' },
        ],
      },
      {
        label: 'New ReplicaSet (v2)',
        spans: [
          { start: 10, end: 35, label: '1', tone: 'brand' },
          { start: 35, end: 60, label: '2', tone: 'brand' },
          { start: 60, end: 100, label: '3 pods', tone: 'brand' },
        ],
      },
    ],
    marks: [{ at: 35, label: 'first v2 pod Ready' }],
    caption:
      'With «maxSurge: 1» and «maxUnavailable: 0» a new pod must be **Ready** before an old pod goes. The old ReplicaSet stays at 0 replicas, so «kubectl rollout undo» only scales it up again.',
  },
  'workloads/jobs-cronjobs': {
    kind: 'flow',
    title: 'CronJob, Job, Pod',
    steps: [
      {
        label: 'CronJob',
        note: 'A schedule and a Job template.',
        tone: 'iris',
        chips: ['*/5 * * * *'],
      },
      { label: 'Job', note: 'One run. Tracks completions.', tone: 'sky', chips: ['backoffLimit'] },
      {
        label: 'Pod',
        note: 'Runs to the end, then stops.',
        tone: 'teal',
        chips: ['restartPolicy: Never'],
      },
      { label: 'Completed', note: 'Exit code 0. Logs stay for a while.', tone: 'easy' },
    ],
    edges: ['at each tick', 'creates', 'exit 0'],
    caption:
      'A Deployment restarts a pod that exits, so it is wrong for work that finishes. A Job retries a failed pod up to «backoffLimit». «concurrencyPolicy: Forbid» stops a slow run from overlapping the next one.',
  },
  'workloads/daemonsets-sidecars': {
    kind: 'decision',
    title: 'Which controller fits the work?',
    questions: [
      {
        ask: 'Must one copy run on every node?',
        yes: { label: 'DaemonSet', note: 'Log shippers, node agents.', tone: 'iris' },
      },
      {
        ask: 'Does the work finish?',
        yes: { label: 'Job or CronJob', note: 'Batch and scheduled runs.', tone: 'sky' },
      },
      {
        ask: 'Does each replica need its own name and disk?',
        yes: { label: 'StatefulSet', note: 'Databases, brokers.', tone: 'teal' },
      },
    ],
    otherwise: { label: 'Deployment', note: 'A stateless service.', tone: 'brand' },
    caption:
      'Inside the pod the same idea holds: an **init container** runs to the end before the app starts, and a **sidecar** runs beside the app for its whole life.',
  },

  'networking/services': {
    kind: 'flow',
    title: 'How a request finds a pod',
    steps: [
      { label: 'Client pod', note: 'Calls «http://tugboat».', tone: 'plain' },
      {
        label: 'Cluster DNS',
        note: 'Returns the ClusterIP.',
        tone: 'sky',
        chips: ['tugboat.default.svc'],
      },
      {
        label: 'Service',
        note: 'A virtual IP that never changes.',
        tone: 'brand',
        chips: ['selector: app=tugboat'],
      },
    ],
    edges: ['look up', 'connect'],
    fork: {
      label: 'kube-proxy picks one Ready pod',
      boxes: [
        { label: 'Pod A', note: '10.244.1.7', tone: 'teal' },
        { label: 'Pod B', note: '10.244.2.4', tone: 'teal' },
        { label: 'Pod C', note: '10.244.1.9', tone: 'teal' },
      ],
    },
    caption:
      'A Service finds pods by **label**, not by IP. The list of matching Ready pods is its endpoints. When «kubectl get endpointslices» shows none, the selector does not match or no pod is Ready.',
  },
  'networking/reach-from-outside': {
    kind: 'spectrum',
    title: 'Four ways to reach a Service',
    from: 'Inside the cluster only',
    to: 'Open to the world',
    stops: [
      { label: 'ClusterIP', note: 'The default. Pods only.', tone: 'plain' },
      { label: 'port-forward', note: 'A tunnel from your laptop. Debugging.', tone: 'sky' },
      {
        label: 'NodePort',
        note: 'The same port on every node.',
        tone: 'iris',
        chips: ['30000-32767'],
      },
      { label: 'LoadBalancer', note: 'A real external IP from the cloud.', tone: 'brand' },
    ],
    caption:
      'Each type builds on the one before: a LoadBalancer has a NodePort, and a NodePort has a ClusterIP. On kind, **cloud-provider-kind** plays the cloud and hands out the external IP.',
  },
  'networking/ingress': {
    kind: 'flow',
    title: 'One front door, many Services',
    steps: [
      { label: 'Browser', note: '«shop.local/api»', tone: 'plain' },
      { label: 'LoadBalancer', note: 'One external IP for everything.', tone: 'sky' },
      {
        label: 'Ingress controller',
        note: 'A proxy pod that reads the Ingress rules.',
        tone: 'brand',
      },
    ],
    edges: ['HTTP', 'forward'],
    fork: {
      label: 'Routes by host and path',
      boxes: [
        { label: '/api', note: 'Service «api»', tone: 'teal' },
        { label: '/', note: 'Service «web»', tone: 'teal' },
      ],
    },
    caption:
      'An Ingress object is only rules. Without an **Ingress controller** to read them, nothing listens and the Ingress gets no address. One LoadBalancer serves many Services, so you pay for one.',
  },
  'networking/gateway-api': {
    kind: 'layers',
    title: 'Three objects, three owners',
    rail: 'Each role owns one object',
    layers: [
      {
        label: 'GatewayClass',
        note: 'Which controller implements it. The provider owns it.',
        tone: 'plain',
      },
      {
        label: 'Gateway',
        note: 'The entry point: ports, TLS, who may attach. The platform team owns it.',
        tone: 'iris',
      },
      {
        label: 'HTTPRoute',
        note: 'The routing of one app. The app team owns it.',
        tone: 'brand',
        chips: ['weight: 90', 'weight: 10'],
      },
      { label: 'Services', note: 'The backends a route sends traffic to.', tone: 'teal' },
    ],
    caption:
      'Ingress puts everything in one object and hides features in annotations. Gateway API splits the roles and makes a **traffic split** a normal field: two «backendRefs» with weights give a canary.',
  },

  'config/configmaps': {
    kind: 'flow',
    title: 'One image, config from outside',
    steps: [{ label: 'ConfigMap', note: 'Keys and values, outside the image.', tone: 'brand' }],
    fork: {
      label: 'Two ways into the pod',
      boxes: [
        {
          label: 'Environment variables',
          note: 'Read once at start. A change needs a restart.',
          tone: 'medium',
          chips: ['envFrom'],
        },
        {
          label: 'Mounted files',
          note: 'Updated in place within about a minute.',
          tone: 'easy',
          chips: ['volumeMounts'],
        },
      ],
    },
    caption:
      'The same image runs in dev, staging and prod; only the ConfigMap differs. A changed ConfigMap does **not** restart pods. Environment variables keep the old value until the pod restarts.',
  },
  'config/secrets': {
    kind: 'compare',
    title: 'What a Secret is, and is not',
    columns: [
      {
        label: 'It is',
        tone: 'easy',
        points: [
          'A separate object type with its own RBAC rules',
          'Sent only to nodes that run a pod that needs it',
          'Kept in memory on the node, not on disk',
        ],
      },
      {
        label: 'It is not',
        tone: 'hard',
        points: [
          'Encrypted: base64 is an encoding',
          'Safe in Git as plain YAML',
          'Hidden from anyone who can read Secrets or exec into the pod',
        ],
      },
    ],
    caption:
      'Anyone can decode base64. The protection comes from **RBAC**, from encryption at rest in etcd, and from keeping the real values in a secret manager, not from the Secret format.',
  },
  'config/kustomize': {
    kind: 'flow',
    title: 'One base, an overlay per environment',
    steps: [
      { label: 'base/', note: 'The manifests every environment shares.', tone: 'iris' },
      { label: 'overlays/prod', note: 'Only what differs: replicas, image tag.', tone: 'sky' },
      { label: 'kubectl apply -k', note: 'Builds the final YAML and applies it.', tone: 'brand' },
    ],
    edges: ['patched by', 'rendered by'],
    fork: {
      label: 'configMapGenerator',
      boxes: [
        {
          label: 'tugboat-config-7g2k9',
          note: 'The name carries a hash of the content.',
          tone: 'easy',
        },
      ],
    },
    caption:
      'Kustomize has no templates: an overlay is plain YAML that patches the base. A generated ConfigMap gets a **new name when its content changes**, so the Deployment changes too and the pods roll.',
  },
};
