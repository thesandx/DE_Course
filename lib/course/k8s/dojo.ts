/**
 * The kubectl dojo: a task, one command that does it, and the patterns a correct command must match. A task id is its position, so add new tasks at the end.
 */

import type { DojoTask } from '@/types/k8s';

export const DOJO: readonly DojoTask[] = [
  {
    task: 'List pods in every namespace',
    answer: 'kubectl get pods -A',
    need: ['^kubectl get (po|pods?)\\b', '(-A\\b|--all-namespaces)'],
    output:
      'NAMESPACE     NAME                         READY   STATUS\nkube-system   coredns-7c65d6cfc9-6lq8b     1/1     Running\ndefault       tugboat-7c9d8f6b5-2xk9q      1/1     Running',
  },
  {
    task: 'List pods with their node and IP',
    answer: 'kubectl get pods -o wide',
    need: ['^kubectl get (po|pods?)\\b', '-o ?wide'],
    output:
      'NAME                       READY   STATUS    IP           NODE\ntugboat-7c9d8f6b5-2xk9q    1/1     Running   10.244.1.4   kq-worker',
  },
  {
    task: 'Run a pod named tugboat from image tugboat:v1',
    answer: 'kubectl run tugboat --image=tugboat:v1',
    need: ['^kubectl run tugboat\\b', '--image[= ]tugboat:v1'],
    output: 'pod/tugboat created',
  },
  {
    task: 'Show the full story (events) of pod tugboat',
    answer: 'kubectl describe pod tugboat',
    need: ['^kubectl describe (po|pods?)[ /]tugboat$'],
    output:
      'Events:\n  Normal  Scheduled  12s  default-scheduler  Successfully assigned default/tugboat to kq-worker',
  },
  {
    task: 'Follow the logs of pod tugboat',
    answer: 'kubectl logs -f tugboat',
    need: ['^kubectl logs\\b', '(-f\\b|--follow)', '\\btugboat\\b'],
    output: '09:41:07 tugboat tugboat v1 listening on :8080',
  },
  {
    task: 'Logs of the previous (crashed) container of pod sinker',
    answer: 'kubectl logs sinker --previous',
    need: ['^kubectl logs\\b', '\\bsinker\\b', '(-p\\b|--previous)'],
    output: 'boom',
  },
  {
    task: 'Open a shell in pod tugboat',
    answer: 'kubectl exec -it tugboat -- sh',
    need: [
      '^kubectl exec\\b',
      '(-it|-ti|-i -t|-t -i)',
      '\\btugboat\\b',
      '-- (sh|bash|/bin/sh|/bin/bash)$',
    ],
    output: '$ ',
  },
  {
    task: 'Forward laptop port 8080 to port 8080 of pod tugboat',
    answer: 'kubectl port-forward pod/tugboat 8080:8080',
    need: ['^kubectl port-forward (pod/)?tugboat\\b', '\\b8080:8080\\b'],
    output: 'Forwarding from 127.0.0.1:8080 -> 8080',
  },
  {
    task: 'Apply every manifest in the file deploy.yaml',
    answer: 'kubectl apply -f deploy.yaml',
    need: ['^kubectl apply\\b', '-f deploy\\.yaml$|-f deploy\\.yaml\\b'],
    output: 'deployment.apps/tugboat created',
  },
  {
    task: "Generate (don't create) YAML for a deployment named web with image tugboat:v1",
    answer: 'kubectl create deployment web --image=tugboat:v1 --dry-run=client -o yaml',
    need: [
      '^kubectl create (deploy|deployment) web\\b',
      '--image[= ]tugboat:v1',
      '--dry-run[= ]client',
      '-o ?yaml',
    ],
    output: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web',
  },
  {
    task: 'Scale deployment tugboat to 5 replicas',
    answer: 'kubectl scale deployment tugboat --replicas=5',
    need: [
      '^kubectl scale\\b',
      '(deploy|deployment|deployments)[ /]tugboat\\b',
      '--replicas[= ]5\\b',
    ],
    output: 'deployment.apps/tugboat scaled',
  },
  {
    task: 'Change container tugboat in deployment tugboat to image tugboat:v2',
    answer: 'kubectl set image deployment/tugboat tugboat=tugboat:v2',
    need: [
      '^kubectl set image\\b',
      '(deploy|deployment)[ /]tugboat\\b',
      '\\btugboat=tugboat:v2\\b',
    ],
    output: 'deployment.apps/tugboat image updated',
  },
  {
    task: "Wait for deployment tugboat's rollout to finish",
    answer: 'kubectl rollout status deployment/tugboat',
    need: ['^kubectl rollout status\\b', '(deploy|deployment)[ /]tugboat\\b'],
    output: 'deployment "tugboat" successfully rolled out',
  },
  {
    task: 'Roll deployment tugboat back to the previous version',
    answer: 'kubectl rollout undo deployment/tugboat',
    need: ['^kubectl rollout undo\\b', '(deploy|deployment)[ /]tugboat\\b'],
    output: 'deployment.apps/tugboat rolled back',
  },
  {
    task: 'Restart every pod of deployment tugboat (e.g. to reload env vars)',
    answer: 'kubectl rollout restart deployment/tugboat',
    need: ['^kubectl rollout restart\\b', '(deploy|deployment)[ /]tugboat\\b'],
    output: 'deployment.apps/tugboat restarted',
  },
  {
    task: 'Expose deployment tugboat as a Service on port 80, forwarding to 8080',
    answer: 'kubectl expose deployment tugboat --port=80 --target-port=8080',
    need: [
      '^kubectl expose\\b',
      '(deploy|deployment)[ /]tugboat\\b',
      '--port[= ]80\\b',
      '--target-port[= ]8080\\b',
    ],
    output: 'service/tugboat exposed',
  },
  {
    task: 'Show the EndpointSlices behind Service tugboat',
    answer: 'kubectl get endpointslices -l kubernetes.io/service-name=tugboat',
    need: [
      '^kubectl get endpointslices?\\b',
      '-l kubernetes\\.io/service-name=tugboat|--selector[= ]kubernetes\\.io/service-name=tugboat',
    ],
    output:
      'NAME            ADDRESSTYPE   PORTS   ENDPOINTS\ntugboat-x7k2p   IPv4          8080    10.244.1.4,10.244.2.3',
  },
  {
    task: 'Start a throwaway busybox shell pod named tmp that deletes itself on exit',
    answer: 'kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- sh',
    need: [
      '^kubectl run tmp\\b',
      '--rm\\b',
      '(-it|-ti)\\b',
      '--image[= ]busybox(:[\\w.]+)?',
      '-- ?sh$',
    ],
    output: "If you don't see a command prompt, try pressing enter.\n/ #",
  },
  {
    task: 'Create a ConfigMap tugboat-config with GREETING=Namaste',
    answer: 'kubectl create configmap tugboat-config --from-literal=GREETING=Namaste',
    need: [
      '^kubectl create (cm|configmap) tugboat-config\\b',
      '--from-literal[= ]GREETING=Namaste\\b',
    ],
    output: 'configmap/tugboat-config created',
  },
  {
    task: 'Create a generic Secret api with API_KEY=abc123',
    answer: 'kubectl create secret generic api --from-literal=API_KEY=abc123',
    need: ['^kubectl create secret generic api\\b', '--from-literal[= ]API_KEY=abc123\\b'],
    output: 'secret/api created',
  },
  {
    task: "Print Secret api's API_KEY, decoded",
    answer: "kubectl get secret api -o jsonpath='{.data.API_KEY}' | base64 -d",
    need: [
      '^kubectl get secrets? api\\b',
      "jsonpath=?'?\\{\\.data\\.API_KEY\\}'?",
      '\\|\\s*base64 (-d|--decode)',
    ],
    output: 'abc123',
  },
  {
    task: 'Apply the Kustomize overlay in overlays/prod',
    answer: 'kubectl apply -k overlays/prod',
    need: ['^kubectl apply\\b', '-k overlays/prod/?$'],
    output:
      'configmap/tugboat-config-7h5k9bt2m4 created\nservice/tugboat created\ndeployment.apps/tugboat created',
  },
  {
    task: 'Show CPU and memory usage of pods',
    answer: 'kubectl top pods',
    need: ['^kubectl top (po|pods?)\\b'],
    output:
      'NAME                       CPU(cores)   MEMORY(bytes)\ntugboat-5f9c8d7b6-2kx8m    1m           17Mi',
  },
  {
    task: 'Autoscale deployment tugboat between 2 and 8 replicas at 50% CPU',
    answer: 'kubectl autoscale deployment tugboat --min=2 --max=8 --cpu=50%',
    need: [
      '^kubectl autoscale\\b',
      '(deploy|deployment)[ /]tugboat\\b',
      '--min[= ]2\\b',
      '--max[= ]8\\b',
      '(--cpu[= ]50%|--cpu-percent[= ]50\\b)',
    ],
    output: 'horizontalpodautoscaler.autoscaling/tugboat autoscaled',
  },
  {
    task: 'Safely empty node kq-worker for maintenance (it has DaemonSet pods)',
    answer: 'kubectl drain kq-worker --ignore-daemonsets',
    need: ['^kubectl drain kq-worker\\b', '--ignore-daemonsets\\b'],
    output:
      'node/kq-worker cordoned\nevicting pod default/tugboat-5f9c8d7b6-2kx8m\nnode/kq-worker drained',
  },
  {
    task: 'Put node kq-worker back into service',
    answer: 'kubectl uncordon kq-worker',
    need: ['^kubectl uncordon kq-worker$'],
    output: 'node/kq-worker uncordoned',
  },
  {
    task: 'Can ServiceAccount ci-bot in team-a delete pods in team-a?',
    answer: 'kubectl auth can-i delete pods -n team-a --as=system:serviceaccount:team-a:ci-bot',
    need: [
      '^kubectl auth can-i delete (po|pods?)\\b',
      '(-n|--namespace)[= ]team-a\\b',
      '--as[= ]system:serviceaccount:team-a:ci-bot\\b',
    ],
    output: 'no',
  },
  {
    task: 'Mint a 1-hour token for ServiceAccount ci-bot in team-a',
    answer: 'kubectl create token ci-bot -n team-a --duration=1h',
    need: [
      '^kubectl create token ci-bot\\b',
      '(-n|--namespace)[= ]team-a\\b',
      '--duration[= ](1h|60m|3600s)\\b',
    ],
    output: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ik…',
  },
  {
    task: 'Enforce the restricted Pod Security level on namespace team-a',
    answer: 'kubectl label namespace team-a pod-security.kubernetes.io/enforce=restricted',
    need: [
      '^kubectl label (ns|namespace)[ /]team-a\\b',
      'pod-security\\.kubernetes\\.io/enforce=restricted\\b',
    ],
    output: 'namespace/team-a labeled',
  },
  {
    task: "Look up the docs for a Deployment's strategy field",
    answer: 'kubectl explain deployment.spec.strategy',
    need: ['^kubectl explain (deploy|deployment)\\.spec\\.strategy\\b'],
    output: 'KIND:       Deployment\nFIELD:      strategy <DeploymentStrategy>',
  },
  {
    task: "Switch the current context's default namespace to team-a",
    answer: 'kubectl config set-context --current --namespace=team-a',
    need: ['^kubectl config set-context\\b', '--current\\b', '--namespace[= ]team-a\\b'],
    output: 'Context "kind-kq" modified.',
  },
  {
    task: 'Load image tugboat:v3 into the kind cluster kq',
    answer: 'kind load docker-image tugboat:v3 --name kq',
    need: ['^kind load docker-image\\b', '\\btugboat:v3\\b', '--name[= ]kq\\b'],
    output:
      'Image: "tugboat:v3" with ID "sha256:…" not yet present on node "kq-worker", loading...',
  },
  {
    task: 'Install chart ./tugboat-chart as release dev, or upgrade it if it exists',
    answer: 'helm upgrade --install dev ./tugboat-chart',
    need: ['^helm upgrade\\b', '(--install|-i)\\b', '\\bdev\\b', '\\./tugboat-chart\\b'],
    output: 'Release "dev" has been upgraded. Happy Helming!',
  },
  {
    task: 'Roll Helm release dev back to revision 1',
    answer: 'helm rollback dev 1',
    need: ['^helm rollback dev 1$'],
    output: 'Rollback was a success! Happy Helming!',
  },
  {
    task: 'Taint node kq-worker2 so only pods that tolerate workload=batch are scheduled on it',
    answer: 'kubectl taint node kq-worker2 workload=batch:NoSchedule',
    need: ['^kubectl taint (node|nodes|no) kq-worker2\\b', 'workload=batch:NoSchedule$'],
    output: 'node/kq-worker2 tainted',
  },
  {
    task: 'List every custom resource definition in the cluster',
    answer: 'kubectl get crd',
    need: ['^kubectl get (crd|crds|customresourcedefinitions?)\\b'],
    output: 'NAME                   CREATED AT\npipelines.data.kq.io   2026-11-14T09:12:44Z',
  },
];
