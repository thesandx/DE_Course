/**
 * Port 6: Health & Scaling. Survive the rush. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'health',
  number: 6,
  title: 'Health & Scaling',
  tag: 'Survive the rush',
  hue: 7,
  dir: 'module_06_health_scaling',
  story:
    'Sale weekend is coming and traffic will grow tenfold. Last month one deadlocked pod served errors for twenty minutes because Kubernetes thought it was fine, and a memory leak in one pod took down its neighbours. Today tugboat learns to report its health, stay inside its budget and scale itself.',
  lessons: [
    {
      slug: 'probes',
      title: 'Probes: is it alive, is it ready?',
      pain: 'A container can be running and useless at the same time: deadlocked, still loading, or cut off from its database. Without help, Kubernetes only knows whether the process exists.',
      fix: 'So you add **probes**: liveness restarts a stuck container, readiness takes a pod out of the Service until it can serve, and a startup probe protects slow starters from both.',
      body: '| Probe | When it fails | Ask it |\n|---|---|---|\n| **Readiness** | Pod is removed from Service endpoints. No restart. | "Can I serve requests right now?" |\n| **Liveness** | The kubelet kills and restarts the container. | "Is this process stuck beyond repair?" |\n| **Startup** | Container is restarted; until it succeeds, the other two don\'t run. | "Has it finished booting yet?" |\n\nEach probe can be «httpGet», «tcpSocket», «exec» or «grpc», with «periodSeconds» (default 10), «timeoutSeconds» (1), «failureThreshold» (3) and «initialDelaySeconds».\n\n**Two classic mistakes.** A liveness probe that checks the database restarts every pod when the database blips, turning a small outage into a big one; liveness should only check the process itself. And an aggressive liveness probe on a slow starter kills it before it ever finishes booting; that\'s what startup probes are for.',
      files: [
        {
          name: 'deploy-probes.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        readinessProbe:\n          httpGet:\n            path: /readyz\n            port: 8080\n          periodSeconds: 5\n          failureThreshold: 2\n        livenessProbe:\n          httpGet:\n            path: /healthz\n            port: 8080\n          periodSeconds: 5\n          failureThreshold: 3\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat\nspec:\n  type: NodePort\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080\n    nodePort: 30080',
          notes: [
            [
              'readinessProbe:',
              'Checked every 5 s. Two failures in a row and the pod leaves the Service.',
            ],
            [
              'path: /readyz',
              'tugboat reports not-ready while starting, after /toggle-ready, or when hung.',
            ],
            ['livenessProbe:', 'Three failures (about 15 s) and the container is restarted.'],
            ['path: /healthz', "Fails only when the process itself is broken (tugboat's /hang)."],
          ],
        },
      ],
      sim: 'probes',
      lab: [
        {
          text: 'Set up the folder and a helper that calls a URL inside a specific pod.',
          code: 'mkdir -p ~/kube-quest/module_06_health_scaling && cd ~/kube-quest/module_06_health_scaling\npoke(){ kubectl exec "$1" -- python -c "import urllib.request,sys; print(urllib.request.urlopen(\'http://localhost:8080\'+sys.argv[1]).read().decode())" "$2"; }',
        },
        {
          text: 'Create «deploy-probes.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'deploy-probes.yaml',
        },
        {
          text: 'Apply it and pick one pod to experiment on.',
          code: "kubectl apply -f deploy-probes.yaml && kubectl rollout status deployment/tugboat\nPOD=$(kubectl get pod -l app=tugboat -o jsonpath='{.items[0].metadata.name}'); echo $POD",
        },
        {
          text: 'In the second terminal, keep a watch running.',
          code: 'kubectl get pods -l app=tugboat -w',
          secondTerminal: true,
        },
        {
          text: 'Simulate a dependency outage on that pod.',
          code: "poke $POD /toggle-ready\nsleep 12; for i in $(seq 1 9); do curl -s localhost:30080 | cut -d'|' -f2; done | sort | uniq -c",
          output:
            'ready is now False\n      5  pod tugboat-6c8b9d7f5-lp4vd\n      4  pod tugboat-6c8b9d7f5-x2kqp',
          predict: {
            prompt: '/toggle-ready makes /readyz return 503 on one pod. What happens to that pod?',
            options: [
              "READY becomes 0/1 and it leaves the Service, but it isn't restarted",
              "It's restarted after 15 seconds",
              "It's deleted and replaced",
              'Nothing; readiness is informational',
            ],
            answers: [0],
            why: 'Readiness only controls whether the pod receives traffic. The container keeps running so it can recover by itself.',
          },
        },
        {
          text: 'Bring it back, then hang it instead.',
          code: "poke $POD /toggle-ready\npoke $POD /hang\nsleep 20; kubectl describe pod $POD | grep -E 'Liveness probe failed|will be restarted' | tail -2",
          output:
            '  Warning  Unhealthy  …  Liveness probe failed: HTTP probe failed with statuscode: 500\n  Normal   Killing    …  Container tugboat failed liveness probe, will be restarted',
          predict: {
            prompt:
              '/hang makes /healthz return 500. With period 5 s and failureThreshold 3, what do you expect?',
            options: [
              'After about 15 s the kubelet restarts the container and RESTARTS goes to 1',
              'The pod just leaves the Service',
              'The pod is rescheduled to another node',
              'The node is marked unhealthy',
            ],
            answers: [0],
            why: "Three liveness failures in a row trigger a container restart. The fresh process isn't hung, so the pod recovers by itself.",
          },
        },
        {
          text: 'Break it: make tugboat take 40 seconds to boot. The liveness probe gives it only 15.',
          code: 'kubectl set env deployment/tugboat STARTUP_DELAY=40\nsleep 45; kubectl get pods -l app=tugboat',
          output:
            'NAME                       READY   STATUS    RESTARTS      AGE\ntugboat-7b9f6c4d8-k2m9q    0/1     Running   2 (5s ago)    45s\ntugboat-6c8b9d7f5-lp4vd    1/1     Running   0             6m',
          breakIt: true,
        },
        {
          text: 'Fix it with a startup probe that allows up to 60 seconds (12 × 5 s) to boot.',
          code: 'kubectl patch deployment tugboat --type=json -p=\'[{"op":"add","path":"/spec/template/spec/containers/0/startupProbe","value":{"httpGet":{"path":"/healthz","port":8080},"periodSeconds":5,"failureThreshold":12}}]\'\nkubectl rollout status deployment/tugboat --timeout=180s',
        },
        {
          text: 'Remove the slow-boot setting again.',
          code: 'kubectl set env deployment/tugboat STARTUP_DELAY-',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            "A pod's readiness probe starts failing while its liveness probe passes. What happens?",
          options: [
            "It's removed from Service endpoints and keeps running",
            "It's restarted",
            "It's deleted and replaced on another node",
            "The Deployment's rollout is paused",
          ],
          answers: [0],
          why: "Readiness failures only stop traffic. Restarts are liveness's job, which is why the two checks should look at different things.",
        },
      ],
    },
    {
      slug: 'requests-limits',
      title: 'Requests, limits and the rogue pod',
      pain: "One pod starts consuming 4 GB of memory and nobody told Kubernetes it wasn't supposed to. It starves every other pod on the node, and a cascade begins.",
      fix: 'So you set **requests and limits**: requests reserve capacity and tell the scheduler where a pod fits; limits cap what a container can take.',
      body: "|  | CPU | Memory |\n|---|---|---|\n| **Request** | Reserved share; the scheduler only places pods where requests fit | Same, for memory |\n| **Limit** | Above it the container is **throttled** (slowed down) | Above it the container is **OOMKilled** (exit code 137) |\n\nUnits: CPU in cores or millicores («500m» = half a core); memory in binary units («128Mi»; «128M» is slightly smaller).\n\n**QoS classes** decide who's evicted first when a node runs short of memory: **BestEffort** (no requests or limits) goes first, then **Burstable** (requests below limits), and **Guaranteed** (requests equal limits for every container) goes last.\n\nA **LimitRange** gives defaults to pods that forget, and a **ResourceQuota** caps a whole namespace. Many teams set a memory limit equal to the request and leave CPU unlimited, since throttling hurts latency while spare CPU would otherwise sit idle.",
      files: [
        {
          name: 'deploy-resources.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        resources:\n          requests:\n            cpu: 100m\n            memory: 64Mi\n          limits:\n            cpu: 500m\n            memory: 128Mi\n        readinessProbe:\n          httpGet:\n            path: /readyz\n            port: 8080\n          periodSeconds: 5\n        livenessProbe:\n          httpGet:\n            path: /healthz\n            port: 8080\n          periodSeconds: 5\n          failureThreshold: 3\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat\nspec:\n  type: NodePort\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080\n    nodePort: 30080',
          notes: [
            [
              'requests:',
              'What the scheduler reserves for each pod: a tenth of a core and 64 MiB.',
            ],
            ['cpu: 500m', 'Allowed to burst to half a core, then throttled.'],
            ['memory: 128Mi', 'The hard ceiling. Cross it and the kernel kills the process.'],
          ],
        },
      ],
      sim: 'resources',
      lab: [
        {
          text: 'Install metrics-server, the component behind «kubectl top» and autoscaling. kind needs one extra flag because its kubelets use self-signed certificates.',
          code: 'kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml\nkubectl patch -n kube-system deployment metrics-server --type=json -p \'[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]\'\nkubectl rollout status -n kube-system deployment/metrics-server',
        },
        {
          text: 'Create «deploy-resources.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'deploy-resources.yaml',
        },
        {
          text: 'Apply it and check the QoS class Kubernetes assigned.',
          code: 'cd ~/kube-quest/module_06_health_scaling\nkubectl apply -f deploy-resources.yaml && kubectl rollout status deployment/tugboat\nkubectl get pod -l app=tugboat -o jsonpath=\'{.items[0].status.qosClass}{"\\n"}\'\nsleep 30; kubectl top pods',
          output:
            'Burstable\nNAME                       CPU(cores)   MEMORY(bytes)\ntugboat-5f9c8d7b6-2kx8m    1m           17Mi',
        },
        {
          text: 'Leak memory, 50 MiB at a time, into one pod.',
          code: 'poke(){ kubectl exec "$1" -- python -c "import urllib.request,sys; print(urllib.request.urlopen(\'http://localhost:8080\'+sys.argv[1]).read().decode())" "$2"; }\nPOD=$(kubectl get pod -l app=tugboat -o jsonpath=\'{.items[0].metadata.name}\')\npoke $POD "/leak?mb=50"\npoke $POD "/leak?mb=50"',
          output:
            'now holding 50 MiB on tugboat-5f9c8d7b6-2kx8m\nnow holding 100 MiB on tugboat-5f9c8d7b6-2kx8m',
        },
        {
          text: 'One more.',
          code: 'poke $POD "/leak?mb=50"; sleep 3\nkubectl describe pod $POD | grep -A4 "Last State"',
          output:
            'command terminated with exit code 137\n    Last State:     Terminated\n      Reason:       OOMKilled\n      Exit Code:    137',
          predict: {
            prompt:
              "The pod holds about 100 MiB plus Python's own ~17 MiB, with a 128Mi limit. You leak another 50 MiB. Then?",
            options: [
              'The kernel kills it: OOMKilled, exit code 137, and the container restarts',
              "It's throttled until memory frees up",
              'The pod is evicted to another node',
              'The request is refused with an error',
            ],
            answers: [0],
            why: "Memory can't be throttled. Crossing the limit makes the kernel's OOM killer end the process, and the kubelet restarts the container.",
          },
        },
        {
          text: 'Ask for more CPU than any node has.',
          code: 'kubectl create deployment greedy --image=tugboat:v1\nkubectl set resources deployment greedy --requests=cpu=64\nsleep 5; kubectl get pods -l app=greedy\nkubectl describe pod -l app=greedy | grep FailedScheduling',
          output:
            'greedy-7d6f5c8b9-q2w8x   0/1   Pending   0   5s\n  Warning  FailedScheduling  …  0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient cpu.',
          breakIt: true,
        },
        {
          text: "Clean up the greedy one. (Notice that every kind node reports your laptop's full core count, because all three nodes share one kernel.)",
          code: 'kubectl delete deployment greedy\nkubectl get nodes -o custom-columns=NAME:.metadata.name,CPU:.status.allocatable.cpu,MEMORY:.status.allocatable.memory',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'A container crosses its CPU limit, and another crosses its memory limit. What happens to each?',
          options: [
            'The CPU one is throttled; the memory one is OOMKilled',
            'Both are OOMKilled',
            'Both are throttled',
            'The CPU one is evicted; the memory one is throttled',
          ],
          answers: [0],
          why: "CPU is compressible, so the kernel just slows the container down. Memory isn't, so the only enforcement is killing the process.",
        },
      ],
    },
    {
      slug: 'hpa',
      title: 'HorizontalPodAutoscaler: scale on load',
      pain: "Some days 100 users, some days 10,000. You scale to 8 pods by hand for the spike and watch them sit idle all night. You can't babysit the cluster.",
      fix: 'So you use a **HorizontalPodAutoscaler**: it watches a metric such as CPU and adjusts replicas between a minimum and a maximum.',
      body: "Every 15 seconds the HPA computes:\n\n~~~text\ndesired = ceil( current replicas × current utilization ÷ target utilization )\n~~~\n\n2 pods at 150% of their request with a 50% target gives ceil(2 × 150 ÷ 50) = 6 pods, capped by «maxReplicas».\n\n- Resource metrics (CPU, memory) come from metrics-server. On GKE they're built in.\n- Custom and external metrics (queue backlog, requests per second) come from adapters. On GKE you can scale on a Pub/Sub subscription's backlog through Cloud Monitoring, which is a natural fit for streaming consumers.\n- **KEDA** scales on events (Kafka lag, queue length) and can scale to zero. **VPA** tunes the requests themselves instead of the replica count.",
      note: '**A precise version of "CPU crosses 70%".** The HPA compares the average usage across pods with a percentage of each pod\'s CPU request. No request means no percentage, and the HPA shows «<unknown>». It scales down slowly on purpose: by default it waits 5 minutes of lower load before removing pods.',
      files: [
        {
          name: 'hpa.yaml',
          code: 'apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: tugboat\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: tugboat\n  minReplicas: 2\n  maxReplicas: 8\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: 50',
          notes: [
            [
              'scaleTargetRef:',
              "The Deployment whose replicas the HPA controls. Don't also set replicas by hand; they'll fight.",
            ],
            ['minReplicas: 2', 'Never fewer than two, even at night.'],
            [
              'averageUtilization: 50',
              "Target: average CPU usage at 50% of each pod's request (here 50m of 100m).",
            ],
          ],
        },
      ],
      sim: 'autoscale',
      lab: [
        {
          text: 'Create «hpa.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'hpa.yaml',
        },
        {
          text: 'Apply it next to the deployment from the last lesson, then watch it in the second terminal.',
          code: 'cd ~/kube-quest/module_06_health_scaling\nkubectl apply -f hpa.yaml',
        },
        {
          text: 'In the second terminal, watch the autoscaler. Leave the watch open for the next steps.',
          code: 'kubectl get hpa tugboat -w',
          output:
            'NAME      REFERENCE            TARGETS       MINPODS   MAXPODS   REPLICAS\ntugboat   Deployment/tugboat   cpu: 1%/50%   2         8         2',
          secondTerminal: true,
        },
        {
          text: 'Start a load generator: a busybox loop that asks tugboat to burn 100 ms of CPU per request.',
          code: 'kubectl run load --image=busybox:1.36 --restart=Never -- /bin/sh -c "while true; do wget -q -O- \'http://tugboat/burn?ms=100\' > /dev/null; done"',
          predict: {
            prompt:
              'One client sends one request at a time, each burning 100 ms of CPU. Roughly how hard can it push the cluster?',
            options: [
              "About one core in total, which is 1000% of a single pod's 100m request",
              "A tiny amount, because it's only one client",
              'Unlimited',
              'Exactly 50%, the HPA target',
            ],
            answers: [0],
            why: "Back-to-back 100 ms burns keep about one core busy. Against 100m requests that's far above the 50% target, so the HPA heads for its maximum.",
          },
        },
        {
          text: 'Within a minute or two the HPA scales out. Watch the pods appear.',
          code: 'kubectl get pods -l app=tugboat -w',
          output:
            'tugboat   Deployment/tugboat   cpu: 412%/50%   2   8   2\ntugboat   Deployment/tugboat   cpu: 412%/50%   2   8   8\ntugboat   Deployment/tugboat   cpu: 103%/50%   2   8   8',
        },
        {
          text: 'Stop the load. Scale-down waits about 5 minutes on purpose; keep the watch open to see it.',
          code: 'kubectl delete pod load',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'An HPA shows «cpu: <unknown>/50%» forever. Which two causes are most likely?',
          options: [
            "metrics-server isn't installed, or the pods have no CPU request",
            'The Deployment has too many replicas',
            'The target is too low',
            'The pods are in a different namespace from the Service',
          ],
          answers: [0],
          why: 'Utilization is usage divided by request, measured by metrics-server. Missing either piece leaves the HPA with nothing to compute.',
        },
      ],
    },
    {
      slug: 'pending-and-disruptions',
      title: 'Pending pods, node autoscaling and disruptions',
      pain: 'The HPA did its job, but the nodes are full. New pods sit in Pending. Your cluster had nowhere to put them.',
      fix: "So you add **node autoscaling**: it notices Pending pods and adds nodes, then removes nodes that sit empty. On AWS that's often Karpenter; on GKE it's the cluster autoscaler with node auto-provisioning, or Autopilot doing it for you.",
      body: "**Load ↑** → HPA → **More pods** → scheduler → **Pending** → autoscaler → **New node**\n\n- **cordon** marks a node unschedulable; **drain** cordons it and evicts its pods (for upgrades and maintenance); **uncordon** opens it again. Evicted pods don't move back on their own.\n- A **PodDisruptionBudget** («minAvailable» or «maxUnavailable») limits voluntary disruptions: drains, node upgrades, autoscaler scale-down. It can't stop crashes or hardware failures.\n- «topologySpreadConstraints» and pod anti-affinity spread replicas across nodes or zones, so one failure can't take them all.",
      note: "**Karpenter on Google Cloud.** Karpenter is the official node autoscaler on AWS (EKS Auto Mode) and Azure (AKS node auto-provisioning). GKE uses its own cluster autoscaler, node auto-provisioning and ComputeClasses, and in Autopilot clusters you never manage nodes at all: you pay for what your pods request. A community Karpenter provider for GKE Standard exists, but it isn't Google's.",
      files: [
        {
          name: 'pdb.yaml',
          code: 'apiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: tugboat\nspec:\n  minAvailable: 2\n  selector:\n    matchLabels:\n      app: tugboat',
          notes: [
            [
              'minAvailable: 2',
              'A drain may evict a tugboat pod only while at least 2 others stay available.',
            ],
            ['selector:', 'Which pods the budget protects.'],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «pdb.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'pdb.yaml',
        },
        {
          text: "Remove the HPA so it doesn't fight you, then ask for more than fits: 30 pods at 1 CPU each.",
          code: 'cd ~/kube-quest/module_06_health_scaling\nkubectl delete hpa tugboat\nkubectl set resources deployment tugboat --requests=cpu=1,memory=64Mi\nkubectl scale deployment tugboat --replicas=30\nsleep 10; kubectl get pods -l app=tugboat --field-selector=status.phase=Pending --no-headers | wc -l',
          output: '14',
        },
        {
          text: 'Ask a Pending pod why. On GKE, this exact event is what makes the autoscaler add a node.',
          code: "kubectl describe pod $(kubectl get pod -l app=tugboat --field-selector=status.phase=Pending -o jsonpath='{.items[0].metadata.name}') | grep FailedScheduling",
          output:
            'Warning  FailedScheduling  …  0/3 nodes are available: 1 node(s) had untolerated taint …, 2 Insufficient cpu.',
        },
        {
          text: 'Reset to the sane deployment and 3 replicas, then add the budget.',
          code: 'kubectl apply -f deploy-resources.yaml\nkubectl scale deployment tugboat --replicas=3\nkubectl apply -f pdb.yaml && kubectl get pdb tugboat',
          output:
            'NAME      MIN AVAILABLE   MAX UNAVAILABLE   ALLOWED DISRUPTIONS\ntugboat   2               N/A               1',
        },
        {
          text: 'Drain a worker while curl keeps calling (run the loop in the second terminal).',
          code: "while true; do curl -s -m 1 localhost:30080 | cut -d'|' -f2 || echo FAILED; sleep 0.3; done",
          secondTerminal: true,
        },
        {
          text: 'In the first terminal, find a node that runs a tugboat pod and drain it. Then look at where the pods went.',
          code: "NODE=$(kubectl get pod -l app=tugboat -o jsonpath='{.items[0].spec.nodeName}')\nkubectl drain $NODE --ignore-daemonsets --delete-emptydir-data\nkubectl get pods -l app=tugboat -o wide\nkubectl get nodes",
          output:
            'evicting pod default/tugboat-5f9c8d7b6-2kx8m\nerror when evicting pods/"tugboat-5f9c8d7b6-x9q2w" -n "default" (will retry after 5s): Cannot evict pod as it would violate the pod\'s disruption budget.\n…\nnode/kq-worker drained',
          predict: {
            prompt:
              'You drain a node that runs 2 of the 3 tugboat pods, with minAvailable 2. What does drain do?',
            options: [
              'Evicts one pod, waits until its replacement is Ready elsewhere, then evicts the next',
              'Evicts both at once',
              'Refuses to drain at all',
              'Deletes the PodDisruptionBudget',
            ],
            answers: [0],
            why: 'Eviction respects the budget: only one disruption is allowed at a time, so drain retries until the replacement is Ready and the budget allows the next one.',
          },
        },
        {
          text: 'Open the node again. The pods stay where they are now.',
          code: 'kubectl uncordon $NODE && kubectl get pods -l app=tugboat -o wide',
        },
      ],
      checks: [
        {
          type: 'order',
          prompt: 'Put the autoscaling chain from the story in order.',
          steps: [
            'Traffic rises and average CPU passes the HPA target',
            "The HPA raises the Deployment's replicas",
            "The scheduler can't fit the new pods; they're Pending",
            'The node autoscaler sees Pending pods and adds a node',
            'The pending pods are scheduled onto the new node',
          ],
          why: 'Pod autoscaling and node autoscaling are separate loops. The HPA only asks for pods; the Pending state is the signal for the node autoscaler.',
        },
      ],
    },
  ],
  mission: {
    title: 'Weekend-proof tugboat',
    brief: 'Combine everything from this port into one manifest and prove it under load.',
    tasks: [
      'Probes, requests and limits on tugboat, with a startup probe allowing 60 s',
      'HPA from 2 to 8 replicas at 50% CPU',
      'PodDisruptionBudget with minAvailable 1',
      'topologySpreadConstraints so replicas spread across kq-worker and kq-worker2',
      'Run the load generator, watch the scale-out, and drain one worker during the load with no FAILED lines in the curl loop',
      'Stop the load and watch it scale back to 2 after about 5 minutes',
    ],
    solution:
      "# Add under spec.template.spec in deploy-resources.yaml:\n      topologySpreadConstraints:\n      - maxSkew: 1\n        topologyKey: kubernetes.io/hostname\n        whenUnsatisfiable: ScheduleAnyway\n        labelSelector:\n          matchLabels:\n            app: tugboat\n# and to the container:\n        startupProbe:\n          httpGet:\n            path: /healthz\n            port: 8080\n          periodSeconds: 5\n          failureThreshold: 12\n\nkubectl apply -f deploy-resources.yaml -f hpa.yaml\nkubectl apply -f - <<'EOF'\napiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: tugboat\nspec:\n  minAvailable: 1\n  selector:\n    matchLabels:\n      app: tugboat\nEOF\nkubectl run load --image=busybox:1.36 --restart=Never -- /bin/sh -c \"while true; do wget -q -O- 'http://tugboat/burn?ms=100' > /dev/null; done\"\nkubectl drain kq-worker --ignore-daemonsets --delete-emptydir-data && kubectl uncordon kq-worker\nkubectl delete pod load",
  },
  cleanup:
    'kubectl delete pod load --ignore-not-found\nkubectl delete hpa tugboat --ignore-not-found\nkubectl delete pdb tugboat --ignore-not-found\nkubectl delete deployment tugboat --ignore-not-found\nkubectl delete svc tugboat --ignore-not-found\n# keep metrics-server installed: Port 11 and the capstone use it',
};
