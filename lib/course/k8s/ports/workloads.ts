/**
 * Port 2: Workloads. Keep it running. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'workloads',
  number: 2,
  title: 'Workloads',
  tag: 'Keep it running',
  hue: 3,
  dir: 'module_02_workloads',
  story:
    'Tuesday. Your laptop slept overnight, the bare tugboat pod died with the node, and nobody noticed until a customer did. Today you hand tugboat to controllers that never sleep, ship a new version without downtime, and run batch work the right way.',
  lessons: [
    {
      slug: 'deployments',
      title: 'Deployments: the self-healing robot',
      pain: "A bare pod is a single point of failure. Delete it, drain its node or lose the node, and it's gone.",
      fix: 'So you use a **Deployment**. You say "I want 3", and a controller keeps 3 running, replacing any that disappear.',
      body: "A Deployment doesn't manage pods directly. It creates a **ReplicaSet** for the current version of your pod template, and the ReplicaSet keeps the right number of pods alive. That extra layer is what makes rollouts possible in the next lesson.\n\n**Deployment** → owns → **ReplicaSet** → owns → **Pods**\n\n- The «selector» must match the labels in the pod «template»; that's how the ReplicaSet counts its pods.\n- Pod names look like «tugboat-7c9d8f6b5-x2kqp»: Deployment name, a hash of the pod template, and a random suffix.\n- Never edit a pod a Deployment owns. Your change disappears the moment the pod is replaced. Edit the Deployment.",
      docker: [
        ['docker run --restart=always', 'Deployment (restarts on any node, not just this one)'],
        ['docker compose up --scale web=3', 'replicas: 3'],
      ],
      files: [
        {
          name: 'deploy.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\n  labels:\n    app: tugboat\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080',
          notes: [
            ['apiVersion: apps/v1', 'Deployments live in the apps API group.'],
            [
              'replicas: 3',
              'Desired state: three pods. The controller fixes any difference, in both directions.',
            ],
            [
              'matchLabels:',
              "Which pods this Deployment's ReplicaSet counts as its own. Must match the template labels.",
            ],
            [
              'template:',
              'A pod spec, the same shape as pod.yaml from Port 01, minus apiVersion and kind.',
            ],
            [
              'image: tugboat:v1',
              'Change this and the Deployment rolls out a new ReplicaSet (next lesson).',
            ],
          ],
        },
      ],
      sim: 'loop',
      lab: [
        {
          text: "Set up this port's folder.",
          code: 'mkdir -p ~/kube-quest/module_02_workloads && cd ~/kube-quest/module_02_workloads',
        },
        {
          text: 'Create «deploy.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'deploy.yaml',
        },
        {
          text: 'Apply it and look at all three layers.',
          code: 'kubectl apply -f deploy.yaml\nkubectl get deploy,rs,pods -o wide',
          output:
            'NAME                      READY   UP-TO-DATE   AVAILABLE\ndeployment.apps/tugboat   3/3     3            3\n\nNAME                                 DESIRED   CURRENT   READY\nreplicaset.apps/tugboat-7c9d8f6b5    3         3         3\n\nNAME                          READY   STATUS    NODE\npod/tugboat-7c9d8f6b5-2xk9q   1/1     Running   kq-worker\npod/tugboat-7c9d8f6b5-lp4vd   1/1     Running   kq-worker2\npod/tugboat-7c9d8f6b5-x2kqp   1/1     Running   kq-worker',
        },
        {
          text: 'In a **second terminal**, watch pods continuously.',
          code: 'kubectl get pods -w',
          secondTerminal: true,
        },
        {
          text: 'Delete one pod.',
          code: "kubectl delete pod $(kubectl get pod -l app=tugboat -o jsonpath='{.items[0].metadata.name}')",
          predict: {
            prompt: 'You delete one of the three pods. What do you see in the watch?',
            options: [
              'It terminates and a new pod with a different name appears within seconds',
              'Nothing; the Deployment waits for you to scale it back',
              'All three pods restart',
              'The deleted pod comes back with the same name',
            ],
            answers: [0],
            why: "The ReplicaSet sees 2 pods where 3 are wanted and creates a replacement immediately. It's a new pod, so it gets a new name and IP.",
          },
        },
        {
          text: 'Scale imperatively, then see the scheduler spread the pods.',
          code: 'kubectl scale deployment tugboat --replicas=5\nkubectl get pods -o wide',
        },
        {
          text: 'Scale declaratively: re-apply the file, which still says 3. The file wins.',
          code: 'kubectl apply -f deploy.yaml && kubectl get deploy tugboat',
        },
        {
          text: 'Who owns a pod? Follow the ownerReference.',
          code: 'kubectl get pod -l app=tugboat -o jsonpath=\'{.items[0].metadata.ownerReferences[0].kind}{"\\n"}\'',
          output: 'ReplicaSet',
        },
        {
          text: 'Break a node. Stop one worker container and watch what Kubernetes does. Node failure detection takes about 40 seconds, and pods on a lost node are replaced after a 5-minute grace period, so give it time.',
          code: 'docker stop kq-worker2\nkubectl get nodes -w     # kq-worker2 turns NotReady; Ctrl+C\nkubectl get pods -o wide -w',
          output:
            'kq-worker2   NotReady   <none>   1h   v1.37.0\n# about 5 minutes later the pods on kq-worker2 are replaced on kq-worker',
          breakIt: true,
        },
        {
          text: "Bring the node back. The pods don't move back on their own; the scheduler only places new pods.",
          code: 'docker start kq-worker2\nkubectl get nodes',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'Pods are named «tugboat-7c9d8f6b5-x2kqp». What is «7c9d8f6b5»?',
          options: [
            'A hash of the pod template, naming the ReplicaSet for this version',
            "The node's ID",
            'A random number that changes on every restart',
            'The image digest',
          ],
          answers: [0],
          why: "The middle part is the pod-template hash. Change the template (for example the image) and you get a new ReplicaSet with a new hash; that's how rollouts keep versions apart.",
        },
      ],
    },
    {
      slug: 'rolling-updates',
      title: 'Rolling updates and rollbacks',
      pain: "With Docker you stop the old container and start the new one, and there's a gap. Ship a bad image and you're rebuilding the old one at midnight.",
      fix: 'So you let the Deployment **roll out**: a new ReplicaSet scales up while the old one scales down, and «kubectl rollout undo» takes you back in seconds.',
      body: 'Changing anything in the pod template (image, env, resources) starts a rollout. Changing «replicas» doesn\'t.\n\n| Setting | Default | Meaning |\n|---|---|---|\n| «maxSurge» | 25% | How many extra pods may exist above «replicas» during the rollout |\n| «maxUnavailable» | 25% | How many pods below «replicas» may be unavailable |\n| «progressDeadlineSeconds» | 600 | After this long without progress the rollout is marked failed (it doesn\'t roll back by itself) |\n| «revisionHistoryLimit» | 10 | Old ReplicaSets kept around for undo |\n\nPercentages round so that progress is always possible: with 3 replicas, 25% surge rounds **up** to 1 and 25% unavailable rounds **down** to 0. «strategy: Recreate» kills everything first, for apps that can\'t run two versions at once.\n\nA rollout only knows a new pod is good when it\'s Ready. Without a readiness probe (Port 06) "Ready" just means "the process started".',
      files: [],
      sim: 'rollout',
      lab: [
        {
          text: 'Keep «kubectl get pods -w» running in the second terminal. Roll out v2.',
          code: 'cd ~/kube-quest/module_02_workloads\nkubectl set image deployment/tugboat tugboat=tugboat:v2\nkubectl rollout status deployment/tugboat',
          output:
            'Waiting for deployment "tugboat" rollout to finish: 1 out of 3 new replicas have been updated...\nWaiting for deployment "tugboat" rollout to finish: 2 out of 3 new replicas have been updated...\ndeployment "tugboat" successfully rolled out',
        },
        {
          text: 'Record why, so the history makes sense later.',
          code: 'kubectl annotate deployment/tugboat kubernetes.io/change-cause="v2: orange hull"\nkubectl get rs',
          output:
            'NAME                 DESIRED   CURRENT   READY\ntugboat-6f8d9c7b4d   3         3         3\ntugboat-7c9d8f6b5    0         0         0',
        },
        {
          text: 'See it: forward to the Deployment (picks one pod) and open http://localhost:8080 in Windows. Orange means v2.',
          code: 'kubectl port-forward deployment/tugboat 8080:8080',
          secondTerminal: true,
        },
        {
          text: "Ship a broken release: «tugboat:v3» doesn't exist anywhere.",
          code: 'kubectl set image deployment/tugboat tugboat=tugboat:v3\nkubectl get pods\nkubectl rollout status deployment/tugboat --timeout=30s',
          output:
            'tugboat-5d4f8b7c6-9qkzr   0/1   ImagePullBackOff   0   40s\ntugboat-6f8d9c7b4d-2xk9q   1/1   Running            0   5m\ntugboat-6f8d9c7b4d-lp4vd   1/1   Running            0   5m\ntugboat-6f8d9c7b4d-x2kqp   1/1   Running            0   5m\nerror: timed out waiting for the condition',
          breakIt: true,
          predict: {
            prompt:
              "3 replicas, default strategy (maxSurge rounds to 1, maxUnavailable to 0). You deploy an image that can't be pulled. What's running a minute later?",
            options: [
              '3 old v2 pods still serving, plus 1 new pod stuck in ImagePullBackOff',
              '0 pods: the old ones were killed first',
              '3 new pods in ImagePullBackOff and no old pods',
              'The rollout is rejected before it starts',
            ],
            answers: [0],
            why: "The controller may add 1 surge pod but may not remove an old pod until a new one is Ready. The new pod never gets Ready, so the old three keep serving. That's the safety net.",
          },
        },
        {
          text: 'Roll back, then look at the history.',
          code: 'kubectl rollout undo deployment/tugboat\nkubectl rollout history deployment/tugboat',
          output:
            'REVISION  CHANGE-CAUSE\n1         <none>\n3         <none>\n4         v2: orange hull',
        },
        {
          text: 'Jump back two releases to v1.',
          code: 'kubectl rollout undo deployment/tugboat --to-revision=1 && kubectl rollout status deployment/tugboat',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'replicas: 4, maxSurge: 1, maxUnavailable: 0. During a healthy rollout, what are the most pods running and the fewest Ready?',
          options: [
            'At most 5 pods, never fewer than 4 Ready',
            'At most 4 pods, never fewer than 3 Ready',
            'At most 8 pods, never fewer than 4 Ready',
            'At most 5 pods, never fewer than 3 Ready',
          ],
          answers: [0],
          why: 'Surge 1 allows 4 + 1 = 5 pods; unavailable 0 means 4 must always be Ready. This is the zero-downtime setting, paid for with one extra pod.',
        },
      ],
    },
    {
      slug: 'jobs-cronjobs',
      title: 'Jobs and CronJobs: work that finishes',
      pain: "Your nightly ETL script processes a file and exits 0. Inside a Deployment that's treated as a failure: the container restarts forever and the report runs again and again.",
      fix: 'So you use a **Job** for run-to-completion work and a **CronJob** to run Jobs on a schedule.',
      body: "| Job field | Meaning |\n|---|---|\n| «completions» | How many successful pods make the Job done |\n| «parallelism» | How many run at once |\n| «backoffLimit» | Retries before the Job is marked failed (default 6) |\n| «activeDeadlineSeconds» | Hard timeout for the whole Job |\n| «ttlSecondsAfterFinished» | Delete the Job and its pods this long after it ends |\n\nA Job's pods must use «restartPolicy: Never» or «OnFailure». A CronJob adds «schedule» (cron syntax), «timeZone», and «concurrencyPolicy»: «Allow», «Forbid» (skip a run if the last one is still going) or «Replace».\n\nThis is how data tools run on Kubernetes: Airflow's KubernetesPodOperator and KubernetesExecutor launch each task as a pod, and Spark on Kubernetes runs its driver and executors as pods.",
      docker: [
        ['docker run --rm my-etl', 'A Job'],
        ['cron on a VM + docker run', 'A CronJob'],
      ],
      files: [
        {
          name: 'job.yaml',
          code: 'apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: nightly-report\nspec:\n  completions: 3\n  parallelism: 2\n  backoffLimit: 2\n  ttlSecondsAfterFinished: 600\n  template:\n    spec:\n      restartPolicy: Never\n      containers:\n      - name: report\n        image: tugboat:v1\n        command: ["python", "-c"]\n        args:\n        - |\n          import random, socket, time\n          rows = random.randint(1000, 9999)\n          time.sleep(5)\n          print(f"{socket.gethostname()} processed {rows} rows")',
          notes: [
            ['apiVersion: batch/v1', 'Jobs and CronJobs live in the batch API group.'],
            ['completions: 3', 'Three pods must succeed. Think three partitions of a dataset.'],
            ['parallelism: 2', 'At most two run at the same time.'],
            ['backoffLimit: 2', 'Give up after two failed retries.'],
            ['ttlSecondsAfterFinished', 'Garbage-collect the finished Job after 10 minutes.'],
            [
              'restartPolicy: Never',
              'Required for Jobs (Never or OnFailure). A failed pod is replaced by a new pod instead of restarted in place.',
            ],
            ['command:', "Overrides the image's CMD, like docker run IMAGE python -c '…'."],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «job.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'job.yaml',
        },
        {
          text: 'Run it and watch completions tick up, two pods at a time.',
          code: 'kubectl apply -f job.yaml\nkubectl get jobs -w',
          output:
            'NAME             STATUS    COMPLETIONS   DURATION\nnightly-report   Running   0/3           2s\nnightly-report   Running   2/3           7s\nnightly-report   Complete  3/3           13s',
        },
        {
          text: "Read every pod's output by label.",
          code: 'kubectl logs -l job-name=nightly-report',
          output:
            'nightly-report-4kd9x processed 4821 rows\nnightly-report-9vb2m processed 1377 rows\nnightly-report-tq7hd processed 8840 rows',
        },
        {
          text: 'Schedule one every minute.',
          code: 'kubectl create cronjob tick --image=tugboat:v1 --schedule="*/1 * * * *" -- python -c "import datetime; print(\'tick\', datetime.datetime.now())"\nkubectl get cronjob,jobs -w',
        },
        {
          text: 'After a couple of runs, stop the schedule.',
          code: 'kubectl delete cronjob tick',
        },
        {
          text: 'Break it: a Job whose script always fails.',
          code: 'kubectl create job sink --image=tugboat:v1 -- python -c "import sys; sys.exit(3)"\nkubectl get pods -l job-name=sink -w',
          breakIt: true,
        },
        {
          text: 'After a few minutes of retries with growing gaps, read the verdict.',
          code: 'kubectl describe job sink | tail -4',
          output:
            '  Warning  BackoffLimitExceeded  …  job-controller  Job has reached the specified backoff limit',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'You write a Job whose pod template says «restartPolicy: Always». What happens?',
          options: [
            'The API server rejects it: Jobs only allow Never or OnFailure',
            'It runs forever like a Deployment',
            'It runs once and ignores the policy',
            'The Job controller changes it to Never',
          ],
          answers: [0],
          why: 'Validation rejects Always for Jobs, because a successful container would just be restarted and the Job could never complete.',
        },
      ],
    },
    {
      slug: 'daemonsets-sidecars',
      title: 'DaemonSets, init containers and sidecars',
      pain: 'Some work isn\'t "N copies anywhere". A log agent must run on every node. A migration must finish before the app starts. A log shipper must run next to the app for its whole life.',
      fix: 'So you pick the controller and container type that match the shape of the work.',
      body: "| You need | Use |\n|---|---|\n| N interchangeable copies of a stateless app | **Deployment** |\n| Stable names and a disk per replica (databases) | **StatefulSet** (Port 05) |\n| One pod on every node (log agents, node monitoring, CNI) | **DaemonSet** |\n| Run to completion | **Job** / **CronJob** |\n\n**Taints** repel pods from nodes; **tolerations** let specific pods ignore a taint. kind taints its control-plane node, which is why your apps always land on workers.\n\n**Init containers** run one after another before the app starts and must exit successfully (wait for a database, run migrations). A **native sidecar** is an init container with «restartPolicy: Always»: it starts before the app and keeps running alongside it. That's the supported way to run log shippers and proxies since Kubernetes 1.33.",
      files: [
        {
          name: 'ds.yaml',
          code: 'apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: node-agent\nspec:\n  selector:\n    matchLabels:\n      app: node-agent\n  template:\n    metadata:\n      labels:\n        app: node-agent\n    spec:\n      containers:\n      - name: agent\n        image: tugboat:v1\n        env:\n        - name: GREETING\n          value: "watching this node"',
          notes: [
            ['kind: DaemonSet', 'One pod per eligible node, added automatically when nodes join.'],
            ['selector:', 'Same selector rules as a Deployment.'],
            [
              'value: "watching this node"',
              'Real agents (Fluent Bit, node exporters) mount host paths; ours just runs tugboat.',
            ],
          ],
        },
        {
          name: 'helpers.yaml',
          code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: with-helpers\nspec:\n  initContainers:\n  - name: migrate\n    image: busybox:1.36\n    command: ["sh", "-c", "echo running migrations; sleep 5; echo done"]\n  - name: log-shipper\n    image: busybox:1.36\n    restartPolicy: Always\n    command: ["sh", "-c", "while true; do echo shipping logs; sleep 10; done"]\n  containers:\n  - name: app\n    image: tugboat:v1',
          notes: [
            [
              '- name: migrate',
              'A classic init container: runs, exits 0, then the next one starts.',
            ],
            [
              'restartPolicy: Always',
              'This turns an init container into a native sidecar: it starts before the app and keeps running.',
            ],
            [
              'containers:',
              'The app starts only after the migration finished and the sidecar started.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «ds.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'ds.yaml',
        },
        {
          text: 'Apply it. Three nodes, so three pods?',
          code: 'kubectl apply -f ds.yaml\nkubectl get pods -l app=node-agent -o wide\nkubectl describe node kq-control-plane | grep Taints',
          output:
            'node-agent-8w2lp   1/1   Running   kq-worker\nnode-agent-q7c4n   1/1   Running   kq-worker2\nTaints:             node-role.kubernetes.io/control-plane:NoSchedule',
          predict: {
            prompt: 'Your cluster has 3 nodes. How many node-agent pods will run?',
            options: [
              '2: the control-plane node is tainted',
              '3: one per node',
              '1: DaemonSets start with one',
              '0 until you set replicas',
            ],
            answers: [0],
            why: 'The control-plane node carries the taint node-role.kubernetes.io/control-plane:NoSchedule. Without a matching toleration the DaemonSet skips it.',
          },
        },
        {
          text: 'Add a toleration and watch the third pod appear.',
          code: 'kubectl patch daemonset node-agent --type=json -p \'[{"op":"add","path":"/spec/template/spec/tolerations","value":[{"key":"node-role.kubernetes.io/control-plane","operator":"Exists","effect":"NoSchedule"}]}]\'\nkubectl get pods -l app=node-agent -o wide',
        },
        {
          text: 'Create «helpers.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'helpers.yaml',
        },
        {
          text: "Watch the init sequence, then read each container's logs.",
          code: 'kubectl apply -f helpers.yaml\nkubectl get pod with-helpers -w',
          output:
            'with-helpers   0/2   Init:0/2          0   1s\nwith-helpers   0/2   Init:1/2          0   7s\nwith-helpers   1/2   PodInitializing   0   8s\nwith-helpers   2/2   Running           0   9s',
        },
        {
          text: 'Read the logs of the init container, then the logs of the sidecar. Each container of a pod has its own log.',
          code: 'kubectl logs with-helpers -c migrate\nkubectl logs with-helpers -c log-shipper',
        },
      ],
      checks: [
        {
          type: 'match',
          prompt: 'Match each job to the right workload type.',
          pairs: [
            ['Fluent Bit log agent on every node', 'DaemonSet'],
            ['Stateless REST API with 5 replicas', 'Deployment'],
            ["Hourly export of yesterday's orders", 'CronJob'],
            ['Postgres with a disk per replica', 'StatefulSet'],
            ['Wait for the database before the app starts', 'Init container'],
          ],
          why: 'Choose by the shape of the work: per-node, N copies, scheduled, stateful identity, or before-start.',
        },
      ],
    },
  ],
  mission: {
    title: 'Zero-downtime release',
    brief: 'Ship v2 without dropping a request, survive a bad release, and schedule a heartbeat.',
    tasks: [
      'Deployment tugboat with 4 replicas and strategy maxSurge 1, maxUnavailable 0',
      'Roll out tugboat:v2 with change-cause "v2 orange" and watch the ReplicaSets swap',
      'Deploy tugboat:v3 and confirm all 4 v2 pods keep running',
      'Undo the bad release and check rollout history',
      'CronJob heartbeat every 2 minutes with concurrencyPolicy Forbid and successfulJobsHistoryLimit 2',
      'Clean up everything from this port',
    ],
    solution:
      'cat > mission.yaml <<\'EOF\'\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  replicas: 4\n  strategy:\n    type: RollingUpdate\n    rollingUpdate:\n      maxSurge: 1\n      maxUnavailable: 0\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n---\napiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: heartbeat\nspec:\n  schedule: "*/2 * * * *"\n  concurrencyPolicy: Forbid\n  successfulJobsHistoryLimit: 2\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: OnFailure\n          containers:\n          - name: beat\n            image: tugboat:v1\n            command: ["python", "-c", "print(\'lub-dub\')"]\nEOF\nkubectl apply -f mission.yaml\nkubectl set image deployment/tugboat tugboat=tugboat:v2\nkubectl annotate deployment/tugboat kubernetes.io/change-cause="v2 orange"\nkubectl get rs -w\nkubectl set image deployment/tugboat tugboat=tugboat:v3 && sleep 30 && kubectl get pods\nkubectl rollout undo deployment/tugboat && kubectl rollout history deployment/tugboat\nkubectl delete -f mission.yaml',
  },
  cleanup:
    'kubectl delete deployment tugboat --ignore-not-found\nkubectl delete daemonset node-agent --ignore-not-found\nkubectl delete job nightly-report sink --ignore-not-found\nkubectl delete pod with-helpers --ignore-not-found\nkubectl delete cronjob tick --ignore-not-found',
};
