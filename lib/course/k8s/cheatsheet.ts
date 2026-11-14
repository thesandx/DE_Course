/**
 * The cheatsheet: Docker commands beside their Kubernetes match, and the kubectl commands of the labs, grouped by job.
 */

import type { CheatGroup, RosettaRow } from '@/types/k8s';

export const ROSETTA: readonly RosettaRow[] = [
  {
    docker: 'docker run -d --name app img',
    kubernetes: 'kubectl run app --image=img',
    note: 'Better: a Deployment',
  },
  {
    docker: 'docker run --restart=always',
    kubernetes: 'Deployment (controller recreates pods anywhere)',
    note: '',
  },
  {
    docker: 'docker ps',
    kubernetes: 'kubectl get pods',
    note: '',
  },
  {
    docker: 'docker logs -f app',
    kubernetes: 'kubectl logs -f app',
    note: '--previous for the last crash',
  },
  {
    docker: 'docker exec -it app sh',
    kubernetes: 'kubectl exec -it app -- sh',
    note: '',
  },
  {
    docker: 'docker inspect app',
    kubernetes: 'kubectl describe pod app / kubectl get pod app -o yaml',
    note: '',
  },
  {
    docker: 'docker run -p 8080:8080',
    kubernetes: 'kubectl port-forward pod/app 8080:8080',
    note: 'Or a Service',
  },
  {
    docker: 'docker run -e KEY=val',
    kubernetes: 'env in the pod spec',
    note: 'From a ConfigMap or Secret',
  },
  {
    docker: 'docker run -v data:/data',
    kubernetes: 'volumeMounts + a PersistentVolumeClaim',
    note: '',
  },
  {
    docker: 'docker network + container DNS',
    kubernetes: 'Service DNS (name.namespace)',
    note: '',
  },
  {
    docker: 'docker compose up --scale web=3',
    kubernetes: 'Deployment replicas: 3',
    note: '',
  },
  {
    docker: 'docker compose file',
    kubernetes: 'Manifests applied with kubectl apply -f / -k',
    note: '',
  },
  {
    docker: 'docker stop / rm',
    kubernetes: 'kubectl delete',
    note: '',
  },
  {
    docker: 'docker build + push',
    kubernetes: 'Same: Kubernetes never builds images',
    note: 'kind load for local clusters',
  },
  {
    docker: 'docker stats',
    kubernetes: 'kubectl top pods',
    note: 'Needs metrics-server',
  },
];

export const KUBECTL: readonly CheatGroup[] = [
  {
    group: 'Look around',
    items: [
      {
        command: 'kubectl get pods -A -o wide',
        does: 'Every pod, with node and IP',
      },
      {
        command: 'kubectl get all -n NS',
        does: 'Common objects in a namespace',
      },
      {
        command: 'kubectl describe pod NAME',
        does: 'Spec, state and events',
      },
      {
        command: 'kubectl get events --sort-by=.lastTimestamp',
        does: 'Recent cluster events',
      },
      {
        command: 'kubectl get pod NAME -o yaml',
        does: 'Full object including status',
      },
      {
        command: 'kubectl explain deployment.spec',
        does: 'Field documentation',
      },
      {
        command: 'kubectl api-resources',
        does: 'Every object type',
      },
    ],
  },
  {
    group: 'Debug',
    items: [
      {
        command: 'kubectl logs -f NAME',
        does: 'Follow logs',
      },
      {
        command: 'kubectl logs NAME --previous',
        does: 'Logs of the crashed container',
      },
      {
        command: 'kubectl logs -l app=X --all-containers',
        does: 'Logs by label',
      },
      {
        command: 'kubectl exec -it NAME -- sh',
        does: 'Shell in a container',
      },
      {
        command: 'kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- sh',
        does: 'Throwaway client pod',
      },
      {
        command: 'kubectl port-forward svc/NAME 8080:80',
        does: 'Tunnel to a Service',
      },
      {
        command: 'kubectl top pods',
        does: 'CPU and memory',
      },
      {
        command: 'kubectl debug -it NAME --image=busybox:1.36 --target=CONTAINER',
        does: 'Ephemeral debug container',
      },
    ],
  },
  {
    group: 'Change',
    items: [
      {
        command: 'kubectl apply -f FILE / -k DIR',
        does: 'Create or update declaratively',
      },
      {
        command: 'kubectl diff -f FILE',
        does: 'Preview what apply would change',
      },
      {
        command: 'kubectl scale deploy/NAME --replicas=N',
        does: 'Scale',
      },
      {
        command: 'kubectl set image deploy/NAME C=IMG',
        does: 'New image, new rollout',
      },
      {
        command: 'kubectl rollout status|history|undo|restart deploy/NAME',
        does: 'Manage rollouts',
      },
      {
        command: 'kubectl delete -f FILE',
        does: 'Delete what a file created',
      },
      {
        command: 'kubectl label|annotate RESOURCE NAME k=v',
        does: 'Add metadata',
      },
    ],
  },
  {
    group: 'Generate YAML',
    items: [
      {
        command: 'kubectl create deploy NAME --image=IMG --dry-run=client -o yaml',
        does: 'Deployment skeleton',
      },
      {
        command: 'kubectl create svc clusterip NAME --tcp=80:8080 --dry-run=client -o yaml',
        does: 'Service skeleton',
      },
      {
        command: 'kubectl create job NAME --image=IMG --dry-run=client -o yaml -- CMD',
        does: 'Job skeleton',
      },
      {
        command: 'kubectl create cm NAME --from-literal=K=V --dry-run=client -o yaml',
        does: 'ConfigMap',
      },
      {
        command: 'kubectl create secret generic NAME --from-literal=K=V --dry-run=client -o yaml',
        does: 'Secret',
      },
    ],
  },
  {
    group: 'Nodes & access',
    items: [
      {
        command: 'kubectl cordon|drain|uncordon NODE',
        does: 'Maintenance',
      },
      {
        command: 'kubectl auth whoami',
        does: 'Who am I?',
      },
      {
        command: 'kubectl auth can-i VERB RES --as=USER',
        does: 'Permission check',
      },
      {
        command: 'kubectl create token SA --duration=1h',
        does: 'Short-lived token',
      },
      {
        command: 'kubectl config get-contexts',
        does: 'Clusters you can reach',
      },
      {
        command: 'kubectl config use-context NAME',
        does: 'Switch cluster',
      },
      {
        command: 'kubectl config set-context --current --namespace=NS',
        does: 'Default namespace',
      },
    ],
  },
];
