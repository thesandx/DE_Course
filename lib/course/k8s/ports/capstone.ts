/**
 * Port 13: Capstone. Launch the fleet, then sail to GKE. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'capstone',
  number: 13,
  title: 'Capstone',
  tag: 'Launch the fleet, then sail to GKE',
  hue: 6,
  dir: 'capstone',
  story:
    "Everything comes together. You'll deploy a small but real platform (a web app, a database and a scheduled ingestion job) with every safeguard from the course, put it through chaos drills on your laptop, and then run the same manifests on GKE Autopilot with a Google load balancer and keyless access to Cloud Storage.",
  lessons: [
    {
      slug: 'fleet',
      title: 'The fleet: one manifest, every port',
      pain: 'Each port solved one problem in isolation. Production needs all the answers at once, and they interact: default-deny policies meet health probes, restricted pod security meets the Postgres image, autoscaling meets disruption budgets.',
      fix: 'So you build **fleet**: tugboat, Postgres and an ingestion CronJob in one hardened namespace, then prove it with chaos drills.',
      body: "| Port | Concept | Where in fleet.yaml |\n|---|---|---|\n| 1–2 | Deployments, CronJobs | tugboat Deployment, ingest CronJob |\n| 3 | Services, Gateway API | tugboat Service, fleet-gw, HTTPRoute |\n| 4 | ConfigMaps, Secrets | tugboat-config, pg-secret |\n| 5 | StatefulSets, PVCs | pg with volumeClaimTemplates and a headless Service |\n| 6 | Probes, resources, HPA, PDB, spreading | tugboat's probes, requests, HPA, PDB, topologySpreadConstraints |\n| 7 | Pod Security, securityContext | Namespace label restricted; every pod hardened (Postgres runs as UID 999) |\n| 8 | NetworkPolicies | Default deny both ways, DNS allowed, only ingest reaches pg |\n| 9 | ServiceAccount tokens | automountServiceAccountToken: false on pods that never call the API |\n| 10–11 | GitOps, Helm | Stretch goals in the mission |\n\nTwo details that bite in real clusters: the ingest job reaches Postgres as «pg-0.pg» through the headless Service, and tugboat's ingress policy allows port 8080 from anywhere, because load-balancer health checks and Gateway traffic arrive from outside the namespace.",
      files: [
        {
          name: 'fleet.yaml',
          code: 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: fleet\n  labels:\n    pod-security.kubernetes.io/enforce: restricted\n---\napiVersion: v1\nkind: Secret\nmetadata:\n  name: pg-secret\n  namespace: fleet\nstringData:\n  POSTGRES_PASSWORD: fleet-pass\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: pg\n  namespace: fleet\nspec:\n  clusterIP: None\n  selector:\n    app: pg\n  ports:\n  - port: 5432\n---\napiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: pg\n  namespace: fleet\nspec:\n  serviceName: pg\n  replicas: 1\n  selector:\n    matchLabels:\n      app: pg\n  template:\n    metadata:\n      labels:\n        app: pg\n    spec:\n      securityContext:\n        runAsNonRoot: true\n        runAsUser: 999\n        runAsGroup: 999\n        fsGroup: 999\n        seccompProfile:\n          type: RuntimeDefault\n      containers:\n      - name: postgres\n        image: postgres:17\n        env:\n        - name: POSTGRES_PASSWORD\n          valueFrom:\n            secretKeyRef:\n              name: pg-secret\n              key: POSTGRES_PASSWORD\n        - name: PGDATA\n          value: /var/lib/postgresql/data/pgdata\n        ports:\n        - containerPort: 5432\n        resources:\n          requests:\n            cpu: 100m\n            memory: 256Mi\n          limits:\n            memory: 256Mi\n        securityContext:\n          allowPrivilegeEscalation: false\n          capabilities:\n            drop: ["ALL"]\n        volumeMounts:\n        - name: data\n          mountPath: /var/lib/postgresql/data\n  volumeClaimTemplates:\n  - metadata:\n      name: data\n    spec:\n      accessModes: ["ReadWriteOnce"]\n      resources:\n        requests:\n          storage: 1Gi\n---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: tugboat-config\n  namespace: fleet\ndata:\n  GREETING: "Welcome to the fleet"\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\n  namespace: fleet\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      automountServiceAccountToken: false\n      securityContext:\n        runAsNonRoot: true\n        runAsUser: 10001\n        seccompProfile:\n          type: RuntimeDefault\n      topologySpreadConstraints:\n      - maxSkew: 1\n        topologyKey: kubernetes.io/hostname\n        whenUnsatisfiable: ScheduleAnyway\n        labelSelector:\n          matchLabels:\n            app: tugboat\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        envFrom:\n        - configMapRef:\n            name: tugboat-config\n        resources:\n          requests:\n            cpu: 100m\n            memory: 64Mi\n          limits:\n            memory: 128Mi\n        startupProbe:\n          httpGet:\n            path: /healthz\n            port: 8080\n          periodSeconds: 5\n          failureThreshold: 12\n        readinessProbe:\n          httpGet:\n            path: /readyz\n            port: 8080\n          periodSeconds: 5\n        livenessProbe:\n          httpGet:\n            path: /healthz\n            port: 8080\n          periodSeconds: 10\n        securityContext:\n          allowPrivilegeEscalation: false\n          readOnlyRootFilesystem: true\n          capabilities:\n            drop: ["ALL"]\n        volumeMounts:\n        - name: data\n          mountPath: /data\n        - name: tmp\n          mountPath: /tmp\n      volumes:\n      - name: data\n        emptyDir: {}\n      - name: tmp\n        emptyDir: {}\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat\n  namespace: fleet\nspec:\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080\n---\napiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: tugboat\n  namespace: fleet\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: tugboat\n  minReplicas: 2\n  maxReplicas: 8\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: 50\n---\napiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: tugboat\n  namespace: fleet\nspec:\n  minAvailable: 1\n  selector:\n    matchLabels:\n      app: tugboat\n---\napiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: ingest\n  namespace: fleet\nspec:\n  schedule: "*/1 * * * *"\n  concurrencyPolicy: Forbid\n  successfulJobsHistoryLimit: 2\n  jobTemplate:\n    spec:\n      backoffLimit: 2\n      template:\n        metadata:\n          labels:\n            app: ingest\n        spec:\n          restartPolicy: OnFailure\n          automountServiceAccountToken: false\n          securityContext:\n            runAsNonRoot: true\n            runAsUser: 999\n            seccompProfile:\n              type: RuntimeDefault\n          containers:\n          - name: ingest\n            image: postgres:17\n            env:\n            - name: PGPASSWORD\n              valueFrom:\n                secretKeyRef:\n                  name: pg-secret\n                  key: POSTGRES_PASSWORD\n            command: ["psql", "-h", "pg-0.pg", "-U", "postgres", "-c"]\n            args:\n            - "create table if not exists events(id serial primary key, at timestamptz default now(), source text); insert into events(source) values (\'cron-ingest\'); select count(*) as total_events from events;"\n            securityContext:\n              allowPrivilegeEscalation: false\n              capabilities:\n                drop: ["ALL"]\n---\napiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: fleet-gw\n  namespace: fleet\nspec:\n  gatewayClassName: cloud-provider-kind\n  listeners:\n  - name: http\n    protocol: HTTP\n    port: 80\n---\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: tugboat\n  namespace: fleet\nspec:\n  parentRefs:\n  - name: fleet-gw\n  rules:\n  - backendRefs:\n    - name: tugboat\n      port: 80\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny\n  namespace: fleet\nspec:\n  podSelector: {}\n  policyTypes:\n  - Ingress\n  - Egress\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-dns\n  namespace: fleet\nspec:\n  podSelector: {}\n  policyTypes:\n  - Egress\n  egress:\n  - to:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: kube-system\n      podSelector:\n        matchLabels:\n          k8s-app: kube-dns\n    ports:\n    - protocol: UDP\n      port: 53\n    - protocol: TCP\n      port: 53\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: tugboat-open-8080\n  namespace: fleet\nspec:\n  podSelector:\n    matchLabels:\n      app: tugboat\n  policyTypes:\n  - Ingress\n  ingress:\n  - ports:\n    - protocol: TCP\n      port: 8080\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: pg-from-ingest\n  namespace: fleet\nspec:\n  podSelector:\n    matchLabels:\n      app: pg\n  policyTypes:\n  - Ingress\n  ingress:\n  - from:\n    - podSelector:\n        matchLabels:\n          app: ingest\n    ports:\n    - protocol: TCP\n      port: 5432\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: ingest-to-pg\n  namespace: fleet\nspec:\n  podSelector:\n    matchLabels:\n      app: ingest\n  policyTypes:\n  - Egress\n  egress:\n  - to:\n    - podSelector:\n        matchLabels:\n          app: pg\n    ports:\n    - protocol: TCP\n      port: 5432',
          notes: [
            [
              'pod-security.kubernetes.io/enforce: restricted',
              'Every pod in fleet must pass the restricted level, Postgres included.',
            ],
            [
              'runAsUser: 999',
              "The postgres image's own user. Running as it (with fsGroup 999) satisfies restricted.",
            ],
            [
              'automountServiceAccountToken: false',
              'Neither tugboat nor the job calls the Kubernetes API.',
            ],
            [
              'readOnlyRootFilesystem: true',
              'Writable paths come only from the two emptyDir volumes.',
            ],
            ['"-h", "pg-0.pg"', 'The headless Service gives the database pod a stable DNS name.'],
            ['name: default-deny', 'Nothing in or out of fleet unless another policy allows it.'],
            [
              'name: tugboat-open-8080',
              'No from: clause, so any source may reach tugboat on 8080: clients, the Gateway and health checks.',
            ],
            ['name: pg-from-ingest', 'The database only accepts the ingest job.'],
          ],
        },
      ],
      lab: [
        {
          text: 'Make sure the supporting pieces from earlier ports are running: cloud-provider-kind (Port 03) and metrics-server (Port 06).',
          code: "docker ps --filter name=cloud-provider-kind --format '{{.Names}} {{.Status}}'\nkubectl get deployment metrics-server -n kube-system",
        },
        {
          text: 'Set up the folder.',
          code: 'mkdir -p ~/kube-quest/capstone && cd ~/kube-quest/capstone',
        },
        {
          text: 'Create «fleet.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'fleet.yaml',
        },
        {
          text: 'Launch the fleet.',
          code: 'kubectl apply -f fleet.yaml\nkubectl get pods -n fleet -w',
          output:
            'pg-0                       1/1   Running   0   40s\ntugboat-6f9c8b7d5-4kq2x    1/1   Running   0   40s\ntugboat-6f9c8b7d5-v8m3t    1/1   Running   0   40s',
        },
        {
          text: 'Within two minutes the CronJob has inserted events. Read its last log.',
          code: 'sleep 90; kubectl logs -n fleet -l app=ingest --tail=4',
          output: ' total_events\n--------------\n            2\n(1 row)',
        },
        {
          text: 'Reach the app through the Gateway.',
          code: "GW=$(kubectl get gateway fleet-gw -n fleet -o jsonpath='{.status.addresses[0].value}')\ncurl -s $GW/",
        },
        {
          text: 'Chaos drill 1: kill the database pod. Events keep counting from where they were.',
          code: 'kubectl delete pod pg-0 -n fleet && kubectl wait -n fleet --for=condition=Ready pod/pg-0 --timeout=180s\nsleep 70; kubectl logs -n fleet -l app=ingest --tail=3',
          breakIt: true,
        },
        {
          text: 'Chaos drill 2: an intruder from another namespace tries the database.',
          code: "kubectl run intruder --rm -it --restart=Never --image=busybox:1.36 -- sh -c 'nc -w 2 pg-0.pg.fleet 5432 </dev/null && echo CONNECTED || echo BLOCKED'",
          output: "nc: can't connect to remote host (10.244.2.9): Connection timed out\nBLOCKED",
          breakIt: true,
        },
        {
          text: 'Chaos drill 3: a load spike while a node drains.',
          code: 'kubectl run load --image=busybox:1.36 --restart=Never -- /bin/sh -c "while true; do wget -q -O- \'http://tugboat.fleet/burn?ms=100\' > /dev/null; done"\nkubectl get hpa -n fleet -w',
          breakIt: true,
        },
        {
          text: 'While the load runs, drain a worker. Then bring it back and stop the load.',
          code: 'kubectl drain kq-worker --ignore-daemonsets --delete-emptydir-data\nkubectl uncordon kq-worker\nkubectl delete pod load',
          predict: {
            prompt:
              'Load is up and the HPA scaled tugboat out. You drain kq-worker, which also holds pg-0. What happens to pg-0?',
            options: [
              "Its replacement stays Pending: kind's local volume lives on kq-worker, so it can't move until you uncordon",
              'It moves to kq-worker2 with its data',
              'Its data is wiped and it restarts empty on kq-worker2',
              'drain refuses to touch StatefulSets',
            ],
            answers: [0],
            why: 'A local-path volume pins the pod to its node, so the database is down until the node returns. On GKE, a Persistent Disk can reattach to another node in the same zone, so the pod moves.',
          },
        },
        {
          text: 'Chaos drill 4: a bad release. Roll it out, watch the old pods keep serving, and undo.',
          code: 'kubectl set image -n fleet deployment/tugboat tugboat=tugboat:v9\nsleep 20; kubectl get pods -n fleet -l app=tugboat\nkubectl rollout undo -n fleet deployment/tugboat',
          breakIt: true,
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            "In fleet.yaml, why does tugboat's ingress policy allow port 8080 from any source instead of only from the Gateway?",
          options: [
            'Gateway and load-balancer health-check traffic arrives from outside the namespace, often with node or external source IPs',
            "Because NetworkPolicies can't select Gateways",
            'Because the HPA needs to reach the pods',
            'To let the ingest job call tugboat',
          ],
          answers: [0],
          why: "Traffic from a load balancer doesn't come from a pod you can select with a podSelector. For a public-facing app the usual policy opens the serving port and protects everything else.",
        },
      ],
    },
    {
      slug: 'gke',
      title: 'Sail to GKE',
      pain: 'Everything works on your laptop. Production lives on a cloud, with real load balancers, disks that move between nodes, and nodes that appear when you need them.',
      fix: 'So you run the same manifests on **GKE Autopilot**: push the image to Artifact Registry, change two lines, and Google provides the rest.',
      body: '| Locally (kind) | On GKE Autopilot |\n|---|---|\n| «kind load docker-image» | Push to Artifact Registry |\n| local-path volumes on one node | «standard-rwo» Persistent Disks that reattach within a zone |\n| cloud-provider-kind Gateway | «gke-l7-global-external-managed» Google Cloud Application Load Balancer |\n| Fixed three nodes | Nodes created and removed for you as pods need them |\n| kindnet network policies | Dataplane V2 enforces network policies |\n| Projected KSA tokens only | Workload Identity Federation to Google APIs (Port 09) |\n\nOn Autopilot you never create node pools. Pods are billed by their requests, and GKE may raise very small requests to its minimums.',
      note: "**Cost.** GKE charges a cluster management fee of $0.10 per hour, and the free tier gives each billing account $74.40 of credit per month, enough for one Autopilot or zonal cluster. Autopilot then bills for the CPU, memory and storage your pods request, and the Gateway's load balancer and disks cost a little too. Delete the cluster when you finish a session.",
      files: [],
      lab: [
        {
          text: 'Install the gcloud CLI and the GKE auth plugin in WSL (skip if you already have them).',
          code: 'sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates gnupg curl\ncurl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg\necho "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list\nsudo apt-get update && sudo apt-get install -y google-cloud-cli google-cloud-cli-gke-gcloud-auth-plugin\ngcloud init',
          cloud: true,
        },
        {
          text: 'Pick a project and the Mumbai region, and turn on the APIs.',
          code: 'export PROJECT_ID=$(gcloud config get-value project) REGION=asia-south1\ngcloud services enable container.googleapis.com artifactregistry.googleapis.com',
          cloud: true,
        },
        {
          text: 'Push both tugboat images to Artifact Registry.',
          code: 'gcloud artifacts repositories create kq --repository-format=docker --location=$REGION\ngcloud auth configure-docker $REGION-docker.pkg.dev\nfor v in v1 v2; do docker tag tugboat:$v $REGION-docker.pkg.dev/$PROJECT_ID/kq/tugboat:$v && docker push $REGION-docker.pkg.dev/$PROJECT_ID/kq/tugboat:$v; done',
          cloud: true,
        },
        {
          text: 'Create an Autopilot cluster (about 5 to 10 minutes) and point kubectl at it.',
          code: 'gcloud container clusters create-auto kq-gke --location=$REGION\ngcloud container clusters get-credentials kq-gke --location=$REGION\nkubectl config current-context\nkubectl get gatewayclass',
          output:
            'gke_my-project_asia-south1_kq-gke\nNAME                               CONTROLLER                  ACCEPTED\ngke-l7-global-external-managed     networking.gke.io/gateway   True\ngke-l7-regional-external-managed   networking.gke.io/gateway   True\n…',
          cloud: true,
        },
        {
          text: 'Deploy the same fleet. Only the image path and the GatewayClass change.',
          code: 'cd ~/kube-quest/capstone\nsed -e "s#image: tugboat:#image: $REGION-docker.pkg.dev/$PROJECT_ID/kq/tugboat:#" \\\n    -e "s#gatewayClassName: cloud-provider-kind#gatewayClassName: gke-l7-global-external-managed#" \\\n    fleet.yaml > fleet-gke.yaml\nkubectl apply -f fleet-gke.yaml\nkubectl get pods -n fleet -w',
          cloud: true,
        },
        {
          text: "Watch Autopilot add nodes for your pods, then wait for the Gateway's address (a few minutes while Google builds the load balancer).",
          code: "kubectl get nodes\nkubectl get gateway fleet-gw -n fleet -w\nGW=$(kubectl get gateway fleet-gw -n fleet -o jsonpath='{.status.addresses[0].value}')\ncurl -s http://$GW/",
          output:
            'Welcome to the fleet from tugboat v1 | pod tugboat-… | path / | visits 1 (file /data/visits)',
          cloud: true,
        },
        {
          text: "The story's last chapter, live: generate load, watch the HPA add pods and Autopilot add nodes for them.",
          code: 'kubectl run load -n default --image=busybox:1.36 --restart=Never -- /bin/sh -c "while true; do wget -q -O- \'http://tugboat.fleet/burn?ms=100\' > /dev/null; done"\nkubectl get hpa -n fleet -w     # in one terminal\nkubectl get nodes -w            # in another\nkubectl delete pod load -n default',
          cloud: true,
        },
        {
          text: "Now do Port 09's keyless bucket access on this cluster (its GKE steps), using namespace crew.",
          cloud: true,
        },
        {
          text: 'Clean up so nothing keeps billing.',
          code: 'gcloud container clusters delete kq-gke --location=$REGION --quiet\ngcloud artifacts repositories delete kq --location=$REGION --quiet\ngcloud storage rm -r gs://$PROJECT_ID-kq-cargo 2>/dev/null\nkubectl config use-context kind-kq',
          cloud: true,
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'You drain a GKE node that runs pg-0, whose data is on a standard-rwo Persistent Disk. What happens, compared with kind?',
          options: [
            'pg-0 is rescheduled and its disk reattaches to another node in the same zone',
            'pg-0 stays Pending until the node returns, as on kind',
            'pg-0 restarts with an empty disk',
            'GKE copies the disk to every zone',
          ],
          answers: [0],
          why: "Zonal Persistent Disks detach and reattach to any node in the zone, so the database moves with its data. kind's local-path volumes can't, which is why the drill behaved differently on your laptop.",
        },
      ],
    },
  ],
  mission: {
    title: 'Fleet certification',
    brief: 'Tick every box to finish the course.',
    tasks: [
      'fleet runs on kind with every pod Ready and the namespace enforcing restricted',
      'The ingest CronJob keeps counting events across a pg-0 deletion',
      "An intruder pod outside fleet can't reach Postgres",
      'Under load the HPA scales tugboat out, and a node drain causes no failed requests to tugboat',
      'A bad image rollout is undone with kubectl rollout undo',
      'The same manifests run on GKE Autopilot and answer through a Google load balancer',
      'A pod on GKE reads a bucket through Workload Identity Federation with no key',
      'Stretch: fleet is packaged as a Helm chart and synced by Argo CD from Git',
    ],
    solution:
      "# Acceptance checks\nkubectl get ns fleet --show-labels | grep restricted\nkubectl get pods -n fleet\nkubectl logs -n fleet -l app=ingest --tail=3\nkubectl run intruder --rm -it --restart=Never --image=busybox:1.36 -- sh -c 'nc -w 2 pg-0.pg.fleet 5432 </dev/null && echo CONNECTED || echo BLOCKED'\nwhile true; do curl -s -m 1 $GW/ >/dev/null && echo ok || echo FAILED; sleep 0.3; done   # during the drain\nkubectl rollout history -n fleet deployment/tugboat",
  },
  cleanup:
    'kubectl delete namespace fleet\n# On GKE: delete the cluster, the Artifact Registry repo and the bucket (last lab step).\n# The local cluster: kind delete cluster --name kq   (recreate any time with the setup port)',
};
