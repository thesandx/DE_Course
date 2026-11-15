/**
 * The flashcards. Each card names a port. A card id is its position in the deck of its port, so do not reorder this file.
 */

import type { K8sCard } from '@/types/k8s';

export const CARDS: readonly K8sCard[] = [
  {
    port: 'setup',
    front: 'What is a node in kind?',
    back: 'A Docker container running the kubelet and containerd. Pods run inside it.',
  },
  {
    port: 'setup',
    front: 'Why must you kind load your image?',
    back: "Each kind node has its own containerd image store; images in your Docker aren't visible to it.",
  },
  {
    port: 'setup',
    front: 'Since which Kubernetes version does the kubelet refuse cgroup v1 by default?',
    back: '1.35 (failCgroupV1 defaults to true).',
  },
  {
    port: 'fundamentals',
    front: "What's a Pod?",
    back: 'One or more containers that share an IP, network namespace and volumes, always scheduled together.',
  },
  {
    port: 'fundamentals',
    front: 'Who restarts a crashed container in a bare pod?',
    back: 'The kubelet, on the same node, per restartPolicy. Nothing recreates a deleted pod.',
  },
  {
    port: 'fundamentals',
    front: 'What does CrashLoopBackOff mean?',
    back: 'The container keeps exiting and the kubelet is waiting an increasing delay (up to 5 min) before restarting it.',
  },
  {
    port: 'fundamentals',
    front: 'The four fields every object has',
    back: 'apiVersion, kind, metadata, spec (plus status written by the cluster).',
  },
  {
    port: 'fundamentals',
    front: 'Only component that talks to etcd',
    back: 'The kube-apiserver.',
  },
  {
    port: 'fundamentals',
    front: 'How do control-plane pods start before the API server exists?',
    back: "They're static pods: the kubelet runs manifests from /etc/kubernetes/manifests.",
  },
  {
    port: 'workloads',
    front: 'Deployment → ? → Pods',
    back: 'ReplicaSet. One per pod-template version.',
  },
  {
    port: 'workloads',
    front: 'maxSurge vs maxUnavailable',
    back: 'Surge: extra pods allowed above replicas. Unavailable: pods allowed below replicas during a rollout.',
  },
  {
    port: 'workloads',
    front: 'Zero-downtime rollout settings',
    back: 'maxUnavailable: 0, maxSurge: 1 (plus a readiness probe).',
  },
  {
    port: 'workloads',
    front: 'Undo the last rollout',
    back: 'kubectl rollout undo deployment/NAME',
  },
  {
    port: 'workloads',
    front: 'Allowed restartPolicy values for a Job',
    back: 'Never or OnFailure.',
  },
  {
    port: 'workloads',
    front: 'CronJob setting that skips a run while the last one is still going',
    back: 'concurrencyPolicy: Forbid',
  },
  {
    port: 'workloads',
    front: 'Native sidecar',
    back: 'An init container with restartPolicy: Always: starts before the app and runs alongside it.',
  },
  {
    port: 'networking',
    front: 'Service port vs targetPort',
    back: 'port: what clients call. targetPort: where the container listens.',
  },
  {
    port: 'networking',
    front: 'DNS name of Service api in namespace shop',
    back: 'api.shop.svc.cluster.local (api.shop from another namespace).',
  },
  {
    port: 'networking',
    front: "What fills a Service's EndpointSlices?",
    back: 'Pods that match its selector and are Ready.',
  },
  {
    port: 'networking',
    front: 'Why does a LoadBalancer Service stay pending on kind?',
    back: 'No cloud controller; run cloud-provider-kind.',
  },
  {
    port: 'networking',
    front: 'What does an Ingress need to work?',
    back: 'An Ingress controller that implements its IngressClass.',
  },
  {
    port: 'networking',
    front: "Gateway API's three main objects",
    back: 'GatewayClass (provider), Gateway (entry point), HTTPRoute (routing).',
  },
  {
    port: 'networking',
    front: 'GKE GatewayClass for a global external L7 load balancer',
    back: 'gke-l7-global-external-managed',
  },
  {
    port: 'networking',
    front: 'Status of the community ingress-nginx controller',
    back: 'Retired in March 2026; no further fixes. Use Gateway API or a maintained controller.',
  },
  {
    port: 'config',
    front: 'Which ConfigMap consumption updates without a restart?',
    back: 'A volume mount without subPath.',
  },
  {
    port: 'config',
    front: "Is a Secret's data encrypted?",
    back: 'No, only base64-encoded. Protection comes from RBAC, encryption at rest and keeping it out of Git.',
  },
  {
    port: 'config',
    front: 'data vs stringData in a Secret',
    back: 'data takes base64 values; stringData takes plain text.',
  },
  {
    port: 'config',
    front: 'Why does Kustomize add a hash to generated ConfigMaps?',
    back: 'A content change renames it, changing the pod template and triggering a rollout.',
  },
  {
    port: 'storage',
    front: 'emptyDir lifetime',
    back: "The pod's lifetime: survives container restarts, not pod deletion.",
  },
  {
    port: 'storage',
    front: 'PVC, PV, StorageClass',
    back: 'Claim (request) → Volume (actual disk) ← made by StorageClass (provisioner).',
  },
  {
    port: 'storage',
    front: 'ReadWriteOnce means',
    back: 'Read-write by one node at a time (RWOP is one pod).',
  },
  {
    port: 'storage',
    front: 'Why use strategy: Recreate with an RWO disk?',
    back: 'So the old pod releases the disk before the new one attaches (avoids Multi-Attach).',
  },
  {
    port: 'storage',
    front: 'Three things a StatefulSet gives',
    back: 'Stable names, a PVC per replica, ordered start-up (plus per-pod DNS via a headless Service).',
  },
  {
    port: 'storage',
    front: 'Does a StatefulSet replicate data?',
    back: "No. Each replica has its own empty volume; replication is the database's job.",
  },
  {
    port: 'health',
    front: 'Readiness failure does…',
    back: 'Removes the pod from Service endpoints. No restart.',
  },
  {
    port: 'health',
    front: 'Liveness failure does…',
    back: 'Kubelet kills and restarts the container.',
  },
  {
    port: 'health',
    front: 'What startup probes are for',
    back: 'Hold off liveness/readiness until a slow app has booted.',
  },
  {
    port: 'health',
    front: 'Exceeding CPU limit vs memory limit',
    back: 'CPU: throttled. Memory: OOMKilled (exit 137).',
  },
  {
    port: 'health',
    front: 'QoS class eviction order',
    back: 'BestEffort first, then Burstable, Guaranteed last.',
  },
  {
    port: 'health',
    front: 'HPA formula',
    back: 'desired = ceil(current × currentUtilization ÷ target)',
  },
  {
    port: 'health',
    front: 'HPA shows <unknown>',
    back: 'Missing metrics-server or missing CPU requests.',
  },
  {
    port: 'health',
    front: 'What a PodDisruptionBudget limits',
    back: 'Voluntary disruptions: drains, upgrades, autoscaler scale-down. Not crashes.',
  },
  {
    port: 'health',
    front: "GKE's answer to Karpenter",
    back: 'Cluster autoscaler with node auto-provisioning and ComputeClasses, or Autopilot.',
  },
  {
    port: 'security',
    front: 'Role vs ClusterRole',
    back: 'Role: one namespace. ClusterRole: cluster-wide or reusable via RoleBinding.',
  },
  {
    port: 'security',
    front: 'API group for deployments',
    back: 'apps (core objects like pods and secrets use "")',
  },
  {
    port: 'security',
    front: "Test a ServiceAccount's permissions",
    back: 'kubectl auth can-i VERB RESOURCE -n NS --as=system:serviceaccount:NS:NAME',
  },
  {
    port: 'security',
    front: 'Four settings the restricted level requires',
    back: 'runAsNonRoot, allowPrivilegeEscalation: false, drop ALL capabilities, seccomp RuntimeDefault.',
  },
  {
    port: 'security',
    front: 'Turn on Pod Security for a namespace',
    back: 'Label it pod-security.kubernetes.io/enforce=restricted (or baseline).',
  },
  {
    port: 'netpol',
    front: 'When is a pod isolated for ingress?',
    back: 'As soon as any NetworkPolicy with Ingress in policyTypes selects it.',
  },
  {
    port: 'netpol',
    front: 'Two selectors in one from item vs two items',
    back: 'Same item: AND. Separate items: OR.',
  },
  {
    port: 'netpol',
    front: 'First thing that breaks after default-deny egress',
    back: 'DNS. Allow UDP/TCP 53 to kube-dns.',
  },
  {
    port: 'netpol',
    front: 'Label to select a namespace by name',
    back: 'kubernetes.io/metadata.name',
  },
  {
    port: 'identity',
    front: "Where's the pod's token mounted?",
    back: '/var/run/secrets/kubernetes.io/serviceaccount/token',
  },
  {
    port: 'identity',
    front: 'Why tokens have an audience',
    back: 'So a token is only accepted by the system it was minted for.',
  },
  {
    port: 'identity',
    front: 'Workload Identity principal format',
    back: 'principal://iam.googleapis.com/projects/NUMBER/locations/global/workloadIdentityPools/PROJECT.svc.id.goog/subject/ns/NS/sa/KSA',
  },
  {
    port: 'gitops',
    front: 'Four OpenGitOps principles',
    back: 'Declarative, versioned and immutable, pulled automatically, continuously reconciled.',
  },
  {
    port: 'gitops',
    front: 'Argo CD selfHeal',
    back: 'Reverts manual changes so the cluster matches Git.',
  },
  {
    port: 'gitops',
    front: 'Argo CD prune',
    back: 'Deletes objects that were removed from Git.',
  },
  {
    port: 'gitops',
    front: 'Generate one Argo CD Application per folder',
    back: 'ApplicationSet with a git directory generator.',
  },
  {
    port: 'helm',
    front: 'Chart, release, revision',
    back: 'Package; installed instance; one entry per install/upgrade/rollback.',
  },
  {
    port: 'helm',
    front: 'What does helm rollback create?',
    back: 'A new revision with the old content.',
  },
  {
    port: 'helm',
    front: 'Command for idempotent installs in CI',
    back: 'helm upgrade --install NAME CHART',
  },
  {
    port: 'helm',
    front: 'Helm vs Kustomize in one line',
    back: 'Helm packages software with knobs; Kustomize patches your own YAML per environment.',
  },
  {
    port: 'data',
    front: 'What does a CRD do, and what does it not do?',
    back: 'It adds a new kind to the API, with a schema. It runs nothing. An operator must watch the kind and act.',
  },
  {
    port: 'data',
    front: 'Who creates Spark executor pods on Kubernetes?',
    back: "The driver pod, through the API server. So the driver's ServiceAccount needs RBAC on pods.",
  },
  {
    port: 'data',
    front: 'What makes the memory limit of a Spark executor pod?',
    back: '«spark.executor.memory» plus «spark.executor.memoryOverhead» (10% by default, at least 384 MiB).',
  },
  {
    port: 'data',
    front: 'Spark dynamic allocation on Kubernetes needs which setting?',
    back: '«spark.dynamicAllocation.shuffleTracking.enabled=true», because there is no external shuffle service.',
  },
  {
    port: 'data',
    front: 'KubernetesExecutor or KubernetesPodOperator?',
    back: 'The executor runs every Airflow task in its own pod. The operator is one task that starts a pod with any image.',
  },
  {
    port: 'data',
    front: 'What does a toleration not do?',
    back: 'It does not attract the pod to the tainted nodes. Pair it with a nodeSelector or node affinity.',
  },
  {
    port: 'data',
    front: 'What do you lose when an Airflow task pod is deleted?',
    back: 'Its logs, unless remote logging sends them to object storage.',
  },
];
