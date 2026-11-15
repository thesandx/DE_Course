/**
 * Port 1: Fundamentals. From image to pod. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'fundamentals',
  number: 1,
  title: 'Fundamentals',
  tag: 'From image to pod',
  hue: 2,
  dir: 'module_01_fundamentals',
  story:
    'Monday morning. Your manager says: "tugboat works in Docker. Run it on Kubernetes." You know docker run. Today you learn what Kubernetes adds on top, run tugboat as a Pod, and find out the hard way what happens when it crashes.',
  lessons: [
    {
      slug: 'why-kubernetes',
      title: "Why Docker alone isn't enough",
      pain: "You run tugboat with «docker run -d -p 8080:8080 tugboat:v1» on one VM. At 2 a.m. the VM reboots and nobody is awake. Next month traffic triples and you need four copies on three machines. Then a new version has to ship without downtime. Docker runs containers; it doesn't run a fleet.",
      fix: 'So you use Kubernetes: you declare what you want, and controllers work nonstop to make the cluster match.',
      body: "Kubernetes is a database of desired state plus a crowd of controllers that keep comparing that state with reality and fixing the difference. A thermostat works the same way: you set 22°C, and it keeps measuring and heating until the room matches.\n\n| Component | Job |\n|---|---|\n| **kube-apiserver** | The only front door. Authenticates, validates and stores every object. |\n| **etcd** | Key-value store holding the whole cluster state. |\n| **kube-scheduler** | Picks a node for each new pod based on free capacity and rules. |\n| **kube-controller-manager** | Runs the reconciliation loops: ReplicaSets, Deployments, Jobs, nodes… |\n| **kubelet** | Agent on each node. Starts pods' containers via containerd and reports status. |\n| **kube-proxy** | Programs each node's networking so Service IPs reach pods (Port 03). |\n\nNothing talks to etcd except the API server, and the controllers never talk to each other. They all watch the API server and react. That design is why Kubernetes heals itself: any controller can crash and resume from the stored state.",
      files: [],
      lab: [
        {
          text: 'Ask the cluster where its API server lives.',
          code: 'kubectl cluster-info',
          output:
            'Kubernetes control plane is running at https://127.0.0.1:41235\nCoreDNS is running at https://127.0.0.1:41235/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy',
        },
        {
          text: 'The control plane runs as pods in «kube-system».',
          code: 'kubectl get pods -n kube-system -o wide',
          output:
            'NAME                                       READY   STATUS    NODE\ncoredns-7c65d6cfc9-6lq8b                   1/1     Running   kq-control-plane\netcd-kq-control-plane                      1/1     Running   kq-control-plane\nkindnet-7xq2d                              1/1     Running   kq-worker\nkube-apiserver-kq-control-plane            1/1     Running   kq-control-plane\nkube-controller-manager-kq-control-plane   1/1     Running   kq-control-plane\nkube-proxy-h8x5n                           1/1     Running   kq-worker\nkube-scheduler-kq-control-plane            1/1     Running   kq-control-plane',
        },
        {
          text: 'A puzzle before the next command.',
          code: 'docker exec kq-control-plane ls /etc/kubernetes/manifests',
          output:
            'etcd.yaml\nkube-apiserver.yaml\nkube-controller-manager.yaml\nkube-scheduler.yaml',
          predict: {
            prompt:
              'The API server itself shows up as a pod. But pods are created through the API server. So who starts the API server when the node boots?',
            options: [
              "The kubelet, from manifest files on the node's disk (static pods)",
              'etcd starts it',
              'The scheduler places it like any pod',
              'kind runs it as a separate Docker container',
            ],
            answers: [0],
            why: 'Control-plane components are static pods: the kubelet reads YAML files from /etc/kubernetes/manifests and runs them without asking the API server. The API server then shows mirror copies of them.',
          },
        },
        {
          text: 'Everything Kubernetes knows is an API resource. Skim the list.',
          code: 'kubectl api-resources | head -20',
        },
      ],
      checks: [
        {
          type: 'match',
          prompt: 'Match each control-plane or node component to its job.',
          pairs: [
            ['kube-apiserver', 'Validates and stores every object'],
            ['etcd', 'Key-value store of all cluster state'],
            ['kube-scheduler', 'Chooses a node for each new pod'],
            ['kubelet', 'Starts containers on its node and reports status'],
            ['kube-controller-manager', 'Runs the reconciliation loops'],
          ],
          why: 'Only the API server touches etcd; the scheduler, controllers and kubelets all work by watching the API server.',
        },
      ],
    },
    {
      slug: 'first-pod',
      title: 'Your first Pod',
      pain: "Docker's unit is a container. Kubernetes never schedules a bare container.",
      fix: 'So you run tugboat as a **Pod**: one or more containers that share an IP address, a network namespace and volumes, always placed on the same node together.',
      body: "Most pods hold one container. Extra containers in the same pod (sidecars) can reach each other on «localhost» and share mounted volumes, like containers started with «docker run --network container:…».\n\nEach pod gets its own IP from the cluster's pod network (10.244.x.x in kind). Its hostname is the pod's name, which tugboat prints in every response.\n\nIn real work you rarely create pods by hand; controllers create them for you (Port 02). Creating one directly is the best way to learn the tools.",
      docker: [
        ['docker run', 'kubectl run'],
        ['docker ps', 'kubectl get pods'],
        ['docker logs -f', 'kubectl logs -f'],
        ['docker exec -it … sh', 'kubectl exec -it … -- sh'],
        ['docker inspect', 'kubectl describe / kubectl get -o yaml'],
        ['docker run -p 8080:8080', 'kubectl port-forward'],
        ['docker rm -f', 'kubectl delete pod'],
      ],
      files: [],
      lab: [
        {
          text: "Make a folder for this port's files.",
          code: 'mkdir -p ~/kube-quest/module_01_fundamentals && cd ~/kube-quest/module_01_fundamentals',
        },
        {
          text: 'Run tugboat as a pod.',
          code: 'kubectl run tugboat --image=tugboat:v1 --port=8080',
          output: 'pod/tugboat created',
        },
        {
          text: 'Which node did the scheduler pick, and what IP did the pod get?',
          code: 'kubectl get pods -o wide',
          output:
            'NAME      READY   STATUS    RESTARTS   AGE   IP           NODE\ntugboat   1/1     Running   0          8s    10.244.1.2   kq-worker',
        },
        {
          text: "Read the pod's story. The Events at the bottom are the first place to look when anything goes wrong.",
          code: 'kubectl describe pod tugboat | tail -8',
          output:
            'Events:\n  Type    Reason     Age   From               Message\n  Normal  Scheduled  12s   default-scheduler  Successfully assigned default/tugboat to kq-worker\n  Normal  Pulled     11s   kubelet            Container image "tugboat:v1" already present on machine\n  Normal  Created    11s   kubelet            Created container: tugboat\n  Normal  Started    11s   kubelet            Started container tugboat',
        },
        {
          text: 'Logs work just like docker logs.',
          code: 'kubectl logs tugboat',
          output: '09:41:07 tugboat tugboat v1 listening on :8080 (startup delay 0s)',
        },
        {
          text: 'In a **second terminal**, forward a laptop port to the pod. Leave it running.',
          code: 'kubectl port-forward pod/tugboat 8080:8080',
          output: 'Forwarding from 127.0.0.1:8080 -> 8080',
          secondTerminal: true,
        },
        {
          text: 'Back in the first terminal, call it.',
          code: 'curl -s localhost:8080',
          output: 'Ahoy from tugboat v1 | pod tugboat | path / | visits 1 (file /data/visits)',
          predict: {
            prompt: 'tugboat prints the hostname it runs on. What will the «pod» field say?',
            options: [
              "tugboat, the pod's name",
              "kq-worker, the node's name",
              'A random container ID like 5d2c1e9a7b31',
              'localhost',
            ],
            answers: [0],
            why: "Kubernetes sets a pod's hostname to the pod's name. In plain Docker you got a container ID instead.",
          },
        },
        {
          text: "Open **http://localhost:8080** in your Windows browser. WSL forwards localhost, so you'll see the blue tugboat page.",
          browser: true,
        },
        {
          text: 'Run commands inside the container, as with docker exec.',
          code: "kubectl exec tugboat -- hostname\nkubectl exec -it tugboat -- sh -c 'id && ls /app'",
          output: 'tugboat\nuid=10001(tugboat) gid=10001(tugboat) groups=10001(tugboat)\napp.py',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'A pod has two containers. The sidecar needs to call the main app, which listens on port 9000. Which address works?',
          options: [
            'localhost:9000',
            "The pod's name on port 9000 through DNS",
            "The node's IP on port 9000",
            "It can't; containers in a pod are isolated",
          ],
          answers: [0],
          why: "Containers in one pod share a network namespace, so they reach each other on localhost. It's the main practical difference between a pod and separate containers.",
        },
      ],
    },
    {
      slug: 'crash-vs-delete',
      title: 'Crash vs delete: who heals what?',
      pain: 'A popular story goes: "you run your app as a pod, it crashes, and nobody restarts it." That\'s half right, and the wrong half matters during incidents.',
      fix: "So you learn the split: the **kubelet restarts crashed containers inside a pod**, but **nothing recreates a pod that's deleted or whose node dies**. That gap is exactly why Deployments exist.",
      body: "- **restartPolicy**: «Always» (default), «OnFailure», or «Never». It applies to containers inside the pod, on the same node.\n- **CrashLoopBackOff**: a container that keeps failing is restarted with growing delays (10 s, 20 s, 40 s… capped at 5 minutes). It's a waiting state, not a separate error.\n- **A restart wipes the container's filesystem.** The new container starts from the image, so tugboat's visit counter resets. Port 05 fixes that with volumes.\n- **Deleting a pod** or losing its node removes it for good. Nothing owns it, so nothing brings it back.",
      note: "**Where the popular story is off.** A bare pod's container is restarted after a crash: the default «restartPolicy: Always» tells the kubelet to restart it on the same node. What's missing is anyone to recreate the pod itself after a deletion, an eviction or a dead node.",
      files: [],
      lab: [
        {
          text: 'With port-forward still running, call tugboat three times and watch the visits climb.',
          code: 'for i in 1 2 3; do curl -s localhost:8080; done',
        },
        {
          text: 'In a **third terminal** (or reuse the second after stopping port-forward), watch the pod.',
          code: 'kubectl get pod tugboat -w',
          secondTerminal: true,
        },
        {
          text: 'Crash it.',
          code: 'curl -s localhost:8080/crash',
          output: 'crashing with exit code 1',
          predict: {
            prompt:
              'You call «/crash», which exits the process with code 1. What happens to the pod?',
            options: [
              'Its container restarts in the same pod and RESTARTS becomes 1',
              'The pod is deleted and gone',
              'The pod moves to another node',
              'Nothing; the process keeps running',
            ],
            answers: [0],
            why: 'restartPolicy: Always makes the kubelet restart the container in place. The pod keeps its name, node and IP; only the RESTARTS counter changes.',
          },
        },
        {
          text: 'Port-forward breaks when the container dies. Restart it in the second terminal, then call tugboat again and look at the visit count.',
          code: 'curl -s localhost:8080',
          output: 'Ahoy from tugboat v1 | pod tugboat | path / | visits 1 (file /data/visits)',
        },
        {
          text: 'See why it restarted.',
          code: 'kubectl get pod tugboat\nkubectl describe pod tugboat | grep -A4 "Last State"',
          output:
            'NAME      READY   STATUS    RESTARTS      AGE\ntugboat   1/1     Running   1 (20s ago)   6m\n    Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1',
        },
        {
          text: 'Break it for real: a container that fails every time it starts.',
          code: 'kubectl run sinker --image=tugboat:v1 -- python -c "import sys; print(\'boom\'); sys.exit(1)"\nkubectl get pod sinker -w',
          output:
            'NAME     READY   STATUS             RESTARTS     AGE\nsinker   0/1     Error              0            3s\nsinker   0/1     Error              1 (2s ago)   5s\nsinker   0/1     CrashLoopBackOff   1 (2s ago)   6s\nsinker   0/1     Error              2 (16s ago)  20s',
          breakIt: true,
        },
        {
          text: 'Logs of the previous attempt are often the only clue.',
          code: 'kubectl logs sinker --previous',
          output: 'boom',
        },
        {
          text: 'Now delete the tugboat pod and see whether anything brings it back.',
          code: 'kubectl delete pod tugboat sinker\nkubectl get pods',
          output:
            'pod "tugboat" deleted\npod "sinker" deleted\nNo resources found in default namespace.',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: "A bare pod's node is powered off for good. What happens to the pod?",
          options: [
            "It's never recreated elsewhere, because no controller owns it",
            'The kubelet on another node restarts it',
            'The scheduler moves it to a healthy node',
            'Kubernetes restores it from etcd on a new node',
          ],
          answers: [0],
          why: 'Only controllers (Deployments, StatefulSets, Jobs…) recreate pods. A bare pod is eventually marked failed and removed, and nobody replaces it.',
        },
      ],
    },
    {
      slug: 'declarative-yaml',
      title: 'Speak YAML: declarative objects',
      pain: "Long kubectl run commands aren't repeatable, reviewable or versionable. Next week nobody remembers which flags you used.",
      fix: 'So you write the desired state in a YAML file and «kubectl apply» it. The same file works today, tomorrow, in Git and on GKE.',
      body: "Every Kubernetes object has the same four top-level fields. You write the first three plus «spec»; the cluster writes «status».\n\n| Field | Meaning |\n|---|---|\n| «apiVersion» | API group and version, e.g. «v1» (core) or «apps/v1» |\n| «kind» | The object type: Pod, Deployment, Service… |\n| «metadata» | Name, namespace, labels, annotations |\n| «spec» | What you want |\n| «status» | What the cluster observed (read-only for you) |\n\n**Labels** are key-value tags that everything else selects on: Services find pods by label, Deployments own pods by label, NetworkPolicies allow traffic by label. **Namespaces** group objects and scope names, quotas and permissions.\n\nYou don't have to write YAML from memory: add «--dry-run=client -o yaml» to an imperative command to generate a starting point, and use «kubectl explain» to look up any field.",
      files: [
        {
          name: 'pod.yaml',
          code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: tugboat\n  labels:\n    app: tugboat\n    tier: web\nspec:\n  containers:\n  - name: tugboat\n    image: tugboat:v1\n    ports:\n    - containerPort: 8080\n    env:\n    - name: GREETING\n      value: "Namaste"',
          notes: [
            ['apiVersion: v1', 'Pods live in the core API group, written as just v1.'],
            ['labels:', 'Free-form tags. Other objects will select this pod by app=tugboat.'],
            ['containers:', 'A list: one entry per container in the pod.'],
            ['image: tugboat:v1', 'The image you loaded into kind. Same syntax as docker run.'],
            ['containerPort', "Informational, like EXPOSE. It doesn't publish anything by itself."],
            ['env:', 'Environment variables, like docker run -e GREETING=Namaste.'],
          ],
        },
      ],
      lab: [
        {
          text: 'Generate YAML instead of typing it.',
          code: 'cd ~/kube-quest/module_01_fundamentals\nkubectl run tugboat --image=tugboat:v1 --dry-run=client -o yaml',
        },
        {
          text: 'Create «pod.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'pod.yaml',
        },
        {
          text: 'Apply it, then select pods by label.',
          code: 'kubectl apply -f pod.yaml\nkubectl get pods --show-labels\nkubectl get pods -l tier=web',
          output:
            'pod/tugboat created\nNAME      READY   STATUS    RESTARTS   AGE   LABELS\ntugboat   1/1     Running   0          4s    app=tugboat,tier=web',
        },
        {
          text: 'Change the greeting to «Vanakkam» in pod.yaml and apply again.',
          code: "sed -i 's/Namaste/Vanakkam/' pod.yaml && kubectl apply -f pod.yaml",
          output:
            'The Pod "tugboat" is invalid: spec: Forbidden: pod updates may not change fields other than spec.containers[*].image, …',
          predict: {
            prompt: 'You edit the env value in pod.yaml and run kubectl apply. What happens?',
            options: [
              "The API server rejects it: most of a pod's spec can't change after creation",
              'The container restarts with the new greeting',
              'A second pod is created next to the first',
              'The env var changes live without a restart',
            ],
            answers: [0],
            why: 'Pods are nearly immutable: only a few fields (like the image) can change. To change anything else you replace the pod, which is exactly what Deployments automate.',
          },
        },
        {
          text: 'Look at what the cluster wrote back, and look up a field.',
          code: 'kubectl get pod tugboat -o jsonpath=\'{.status.podIP}{"\\n"}\'\nkubectl explain pod.spec.containers.env',
        },
        {
          text: 'Namespaces scope names. Run a second tugboat in its own namespace, then delete the namespace and everything in it.',
          code: 'kubectl create namespace sandbox\nkubectl apply -f pod.yaml -n sandbox\nkubectl get pods -A | grep tugboat\nkubectl delete namespace sandbox',
          output:
            'default   tugboat   1/1   Running   0   2m\nsandbox   tugboat   1/1   Running   0   3s',
        },
      ],
      checks: [
        {
          type: 'order',
          prompt: 'Put the life of «kubectl apply -f pod.yaml» in order.',
          steps: [
            'kubectl sends the object to the API server',
            'The API server authenticates, validates and stores it in etcd',
            'The scheduler picks a node and records the binding',
            'The kubelet on that node asks containerd to start the container',
            "The kubelet reports the pod's status back to the API server",
          ],
          why: 'Each component watches the API server and acts on its own step. No component calls another directly.',
        },
      ],
    },
  ],
  mission: {
    title: 'Ship the Namaste pod',
    brief: 'Use only YAML and kubectl, no copy-paste from the lessons above.',
    tasks: [
      'Write mission.yaml: a Pod named deckhand with labels app=tugboat and crew=night, GREETING=Namaste and COLOR=#0f766e',
      'Apply it into a new namespace called m1',
      'Port-forward to it and see the teal page in your Windows browser',
      'Print the node it runs on with a single kubectl command',
      'Crash it once with /crash and confirm RESTARTS is 1',
      'Delete the namespace and confirm the pod is gone',
    ],
    solution:
      'cat > mission.yaml <<\'EOF\'\napiVersion: v1\nkind: Pod\nmetadata:\n  name: deckhand\n  labels:\n    app: tugboat\n    crew: night\nspec:\n  containers:\n  - name: tugboat\n    image: tugboat:v1\n    ports:\n    - containerPort: 8080\n    env:\n    - name: GREETING\n      value: "Namaste"\n    - name: COLOR\n      value: "#0f766e"\nEOF\nkubectl create namespace m1\nkubectl apply -f mission.yaml -n m1\nkubectl port-forward -n m1 pod/deckhand 8080:8080        # second terminal\nkubectl get pod deckhand -n m1 -o jsonpath=\'{.spec.nodeName}{"\\n"}\'\ncurl -s localhost:8080/crash; sleep 3; kubectl get pod deckhand -n m1\nkubectl delete namespace m1 && kubectl get pods -n m1',
  },
  cleanup: 'kubectl delete pod tugboat --ignore-not-found',
};
