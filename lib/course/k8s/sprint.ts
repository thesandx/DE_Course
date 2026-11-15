/**
 * The object sprint: one situation, one Kubernetes object or tool that fits.
 */

import type { SprintRound } from '@/types/gcp';

export const SPRINT: readonly SprintRound[] = [
  {
    scenario: 'Keep 3 copies of a stateless API running',
    answer: 'Deployment',
    distractors: ['Pod', 'DaemonSet', 'Job'],
  },
  {
    scenario: 'A log agent on every node',
    answer: 'DaemonSet',
    distractors: ['Deployment', 'StatefulSet', 'CronJob'],
  },
  {
    scenario: 'Postgres with a disk per replica',
    answer: 'StatefulSet',
    distractors: ['Deployment', 'DaemonSet', 'ReplicaSet'],
  },
  {
    scenario: 'Run an ETL script once to completion',
    answer: 'Job',
    distractors: ['Deployment', 'DaemonSet', 'Service'],
  },
  {
    scenario: 'Nightly report at 02:00',
    answer: 'CronJob',
    distractors: ['Job', 'Deployment', 'HPA'],
  },
  {
    scenario: 'A stable name and IP in front of changing pods',
    answer: 'Service (ClusterIP)',
    distractors: ['Ingress', 'Endpoints', 'ConfigMap'],
  },
  {
    scenario: 'Open a port on every node',
    answer: 'Service (NodePort)',
    distractors: ['Service (ClusterIP)', 'Ingress', 'NetworkPolicy'],
  },
  {
    scenario: 'Get a cloud load balancer for one app',
    answer: 'Service (LoadBalancer)',
    distractors: ['Service (NodePort)', 'Ingress', 'PodDisruptionBudget'],
  },
  {
    scenario: 'DNS for each pod of a StatefulSet',
    answer: 'Headless Service',
    distractors: ['LoadBalancer', 'Ingress', 'ExternalName'],
  },
  {
    scenario: 'One entry point, path routing to many services',
    answer: 'Ingress',
    distractors: ['Service (NodePort)', 'NetworkPolicy', 'EndpointSlice'],
  },
  {
    scenario: 'Split traffic 90/10 with a standard API',
    answer: 'HTTPRoute',
    distractors: ['Ingress annotation', 'Service', 'ReplicaSet'],
  },
  {
    scenario: 'Who implements Gateways in this cluster',
    answer: 'GatewayClass',
    distractors: ['IngressClass', 'StorageClass', 'PriorityClass'],
  },
  {
    scenario: 'Non-secret settings injected at runtime',
    answer: 'ConfigMap',
    distractors: ['Secret', 'Annotation', 'Label'],
  },
  {
    scenario: 'A database password',
    answer: 'Secret',
    distractors: ['ConfigMap', 'Annotation', 'Downward API'],
  },
  {
    scenario: 'Same base, different config per environment',
    answer: 'Kustomize overlay',
    distractors: ['Helm hook', 'Init container', 'Annotation'],
  },
  {
    scenario: 'Ask for 10Gi of disk',
    answer: 'PersistentVolumeClaim',
    distractors: ['PersistentVolume', 'StorageClass', 'emptyDir'],
  },
  {
    scenario: 'How to create disks on demand',
    answer: 'StorageClass',
    distractors: ['PersistentVolume', 'PersistentVolumeClaim', 'CSIDriver'],
  },
  {
    scenario: 'Scratch space shared by containers in a pod',
    answer: 'emptyDir',
    distractors: ['PersistentVolumeClaim', 'hostPath', 'ConfigMap'],
  },
  {
    scenario: 'Remove a pod from traffic while it warms up',
    answer: 'Readiness probe',
    distractors: ['Liveness probe', 'Startup probe', 'PDB'],
  },
  {
    scenario: 'Restart a deadlocked container',
    answer: 'Liveness probe',
    distractors: ['Readiness probe', 'HPA', 'Job'],
  },
  {
    scenario: 'Protect a slow-booting app from liveness',
    answer: 'Startup probe',
    distractors: ['Readiness probe', 'initialDelaySeconds: 0', 'PDB'],
  },
  {
    scenario: 'Scale pods on CPU',
    answer: 'HorizontalPodAutoscaler',
    distractors: ['VerticalPodAutoscaler', 'Cluster autoscaler', 'ResourceQuota'],
  },
  {
    scenario: "Tune a pod's requests from observed usage",
    answer: 'VerticalPodAutoscaler',
    distractors: ['HorizontalPodAutoscaler', 'LimitRange', 'PDB'],
  },
  {
    scenario: 'Add nodes when pods are Pending (GKE Standard)',
    answer: 'Cluster autoscaler',
    distractors: ['HPA', 'PDB', 'Taint'],
  },
  {
    scenario: 'Keep 2 pods up during a node drain',
    answer: 'PodDisruptionBudget',
    distractors: ['ReplicaSet', 'Readiness probe', 'Toleration'],
  },
  {
    scenario: 'Default requests for pods that forget',
    answer: 'LimitRange',
    distractors: ['ResourceQuota', 'PriorityClass', 'HPA'],
  },
  {
    scenario: 'Cap total CPU for a namespace',
    answer: 'ResourceQuota',
    distractors: ['LimitRange', 'PDB', 'NetworkPolicy'],
  },
  {
    scenario: 'Keep app pods off the control-plane node',
    answer: 'Taint',
    distractors: ['Toleration', 'Label', 'Annotation'],
  },
  {
    scenario: 'Let a pod run on a tainted node',
    answer: 'Toleration',
    distractors: ['Taint', 'nodeName', 'Affinity'],
  },
  {
    scenario: 'Spread replicas evenly across nodes',
    answer: 'topologySpreadConstraints',
    distractors: ['Taint', 'PDB', 'nodeSelector'],
  },
  {
    scenario: 'An identity for a pod',
    answer: 'ServiceAccount',
    distractors: ['User', 'Secret', 'Role'],
  },
  {
    scenario: 'Allow verbs on resources in one namespace',
    answer: 'Role',
    distractors: ['ClusterRole', 'RoleBinding', 'ServiceAccount'],
  },
  {
    scenario: 'Grant a role to a ServiceAccount in one namespace',
    answer: 'RoleBinding',
    distractors: ['ClusterRoleBinding', 'Role', 'Secret'],
  },
  {
    scenario: 'Check if a user may delete pods',
    answer: 'kubectl auth can-i',
    distractors: ['kubectl describe', 'kubectl explain', 'kubectl top'],
  },
  {
    scenario: 'Reject pods that run as root in a namespace',
    answer: 'Pod Security Admission',
    distractors: ['NetworkPolicy', 'RBAC', 'LimitRange'],
  },
  {
    scenario: 'Block traffic between pods',
    answer: 'NetworkPolicy',
    distractors: ['RBAC', 'Pod Security Admission', 'Service'],
  },
  {
    scenario: 'Pods read Cloud Storage without keys on GKE',
    answer: 'Workload Identity Federation',
    distractors: ['JSON key in a Secret', 'Node service account', 'ConfigMap'],
  },
  {
    scenario: 'Run a migration before the app starts',
    answer: 'Init container',
    distractors: ['Sidecar', 'Job', 'Readiness probe'],
  },
  {
    scenario: 'Ship logs alongside the app for its whole life',
    answer: 'Native sidecar',
    distractors: ['Init container', 'DaemonSet', 'CronJob'],
  },
  {
    scenario: 'Install a third-party app with 40 options',
    answer: 'Helm chart',
    distractors: ['Kustomize patch', 'kubectl run', 'ConfigMap'],
  },
  {
    scenario: 'Git as the source of truth, pulled into the cluster',
    answer: 'Argo CD',
    distractors: ['kubectl apply in CI', 'Helm hook', 'CronJob'],
  },
  {
    scenario: 'Generate one Argo CD app per environment folder',
    answer: 'ApplicationSet',
    distractors: ['App of apps', 'Kustomize', 'Helm'],
  },
  {
    scenario: 'Sync secrets from Google Secret Manager',
    answer: 'External Secrets Operator',
    distractors: ['ConfigMap', 'Sealed Secrets', 'Helm'],
  },
  {
    scenario: "Expose an app on GKE with Google's L7 load balancer",
    answer: 'Gateway (gke-l7-global-external-managed)',
    distractors: ['NodePort', 'Headless Service', 'hostPort'],
  },
  {
    scenario: 'Watch live object changes',
    answer: 'kubectl get -w',
    distractors: ['kubectl logs', 'kubectl explain', 'kubectl top'],
  },
  {
    scenario: 'See CPU and memory per pod',
    answer: 'kubectl top pods',
    distractors: ['kubectl describe', 'kubectl get -o wide', 'kubectl events'],
  },
  {
    scenario: 'Tunnel a laptop port to one pod',
    answer: 'kubectl port-forward',
    distractors: ['NodePort', 'Ingress', 'kubectl proxy'],
  },
  {
    scenario: 'Kubernetes nodes as Docker containers',
    answer: 'kind',
    distractors: ['minikube VM', 'GKE', 'kubeadm on VMs'],
  },
  {
    scenario: 'Add a new kind, such as SparkApplication, to the API',
    answer: 'CustomResourceDefinition',
    distractors: ['ConfigMap', 'Deployment', 'Namespace'],
  },
  {
    scenario: 'Keep web pods off the nodes of the batch pool',
    answer: 'Taint',
    distractors: ['Toleration', 'PodDisruptionBudget', 'NetworkPolicy'],
  },
  {
    scenario: "Cap the total CPU that one team's namespace can request",
    answer: 'ResourceQuota',
    distractors: ['LimitRange', 'HPA', 'PriorityClass'],
  },
  {
    scenario: 'Let serving pods go ahead of batch pods when the cluster is full',
    answer: 'PriorityClass',
    distractors: ['ResourceQuota', 'Taint', 'StatefulSet'],
  },
];
