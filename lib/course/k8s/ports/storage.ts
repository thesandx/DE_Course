/**
 * Port 5: Storage. Give it a memory. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'storage',
  number: 5,
  title: 'Storage',
  tag: 'Give it a memory',
  hue: 6,
  dir: 'module_05_storage',
  story:
    'Friday. tugboat\'s visit counter resets on every deploy, and product has named it "the amnesia bug". Today you find out why containers forget, give tugboat a disk that outlives its pods, and run Postgres the Kubernetes way.',
  lessons: [
    {
      slug: 'ephemeral-storage',
      title: 'Ephemeral by default',
      pain: 'Write a file inside a container, restart the container, and the file is gone. The new container starts from the image, just like after «docker rm» and «docker run».',
      fix: 'So you mount a **volume**. The simplest, «emptyDir», lives as long as the pod: it survives container restarts but disappears when the pod does.',
      body: "| Volume type | Lives as long as | Typical use |\n|---|---|---|\n| Container filesystem | The container | Nothing you care about |\n| «emptyDir» | The pod | Scratch space, caches, files shared between containers in a pod |\n| «configMap» / «secret» / «projected» | The source object | Config and credentials (Port 04) |\n| «persistentVolumeClaim» | The claim, not the pod | Data that must survive (next lesson) |\n| «hostPath» | The node | Node agents only; avoid in apps |\n\n«emptyDir» can also live in RAM with «medium: Memory», which is fast but counts against the container's memory limit.",
      files: [
        {
          name: 'deploy-emptydir.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        volumeMounts:\n        - name: data\n          mountPath: /data\n      volumes:\n      - name: data\n        emptyDir: {}\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat\nspec:\n  type: NodePort\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080\n    nodePort: 30080',
          notes: [
            ['replicas: 1', 'One pod, so every request lands on the same counter.'],
            ['mountPath: /data', 'tugboat writes its visit counter to /data/visits.'],
            [
              'emptyDir: {}',
              'Created empty when the pod starts on a node, deleted when the pod goes.',
            ],
            [
              'nodePort: 30080',
              'A Service survives pod replacement, unlike port-forward, so curl keeps working while you break things.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Set up the folder.',
          code: 'mkdir -p ~/kube-quest/module_05_storage && cd ~/kube-quest/module_05_storage',
        },
        {
          text: 'Create «deploy-emptydir.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'deploy-emptydir.yaml',
        },
        {
          text: 'Apply it and count some visits through the NodePort.',
          code: 'kubectl apply -f deploy-emptydir.yaml && kubectl rollout status deployment/tugboat\nfor i in 1 2 3; do curl -s localhost:30080; done',
          output:
            '… visits 1 (file /data/visits)\n… visits 2 (file /data/visits)\n… visits 3 (file /data/visits)',
        },
        {
          text: 'Crash the container.',
          code: 'curl -s localhost:30080/crash; sleep 4\ncurl -s localhost:30080',
          output: '… visits 4 (file /data/visits)',
          predict: {
            prompt:
              "The counter lives on an emptyDir. After /crash restarts the container, what's the next visit number?",
            options: [
              '4: the emptyDir belongs to the pod, which is still there',
              '1: everything resets on restart',
              '0',
              'It errors until the pod is recreated',
            ],
            answers: [0],
            why: "In Port 01 the counter reset because it lived in the container's own filesystem. An emptyDir is part of the pod, so it survives a container restart.",
          },
        },
        {
          text: 'Now delete the pod. The Deployment makes a fresh one.',
          code: 'kubectl delete pod -l app=tugboat && kubectl rollout status deployment/tugboat\ncurl -s localhost:30080',
          output: '… visits 1 (file /data/visits)',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'How long does an emptyDir volume live?',
          options: [
            'As long as the pod',
            'As long as the container',
            'As long as the node',
            'Until you delete it by hand',
          ],
          answers: [0],
          why: "emptyDir is created when the pod is scheduled to a node and deleted when the pod is removed. Container restarts don't touch it.",
        },
      ],
    },
    {
      slug: 'persistent-volumes',
      title: 'PersistentVolumes and claims',
      pain: 'emptyDir dies with the pod, and Deployments replace pods all the time: every rollout, every drain, every crash of a node.',
      fix: 'So you claim persistent storage: a **PersistentVolumeClaim** asks for a size and access mode, a **StorageClass** provisions the disk, and the data outlives any pod.',
      body: "**Pod** → mounts → **PVC** → bound to → **PV** → made by → **StorageClass**\n\n- **PVC**: your request (\"1Gi, ReadWriteOnce\"). **PV**: the actual disk. **StorageClass**: how to make one on demand (dynamic provisioning).\n- kind's default class «standard» uses the local-path provisioner: a folder on one node's disk. GKE's «standard-rwo» creates a Persistent Disk that can move between nodes in a zone.\n- «volumeBindingMode: WaitForFirstConsumer» delays creating the disk until a pod needs it, so it lands where the pod is scheduled.\n\n| Access mode | Meaning |\n|---|---|\n| ReadWriteOnce (RWO) | Mounted read-write by **one node** (several pods on that node can share it) |\n| ReadWriteOncePod (RWOP) | Mounted by exactly one pod |\n| ReadOnlyMany (ROX) | Read-only on many nodes |\n| ReadWriteMany (RWX) | Read-write on many nodes (NFS, Filestore) |\n\nUse «strategy: Recreate» for a Deployment with an RWO disk: a rolling update would start the new pod while the old one still holds the disk, and on a cloud disk that fails with a Multi-Attach error.",
      files: [
        {
          name: 'pvc.yaml',
          code: 'apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: tugboat-data\nspec:\n  accessModes:\n  - ReadWriteOnce\n  resources:\n    requests:\n      storage: 1Gi',
          notes: [
            [
              'kind: PersistentVolumeClaim',
              'A request for storage. No storageClassName means the default class.',
            ],
            ['ReadWriteOnce', 'One node at a time, the common case for block disks.'],
            ['storage: 1Gi', 'Size requested. Cloud disks are billed on this.'],
          ],
        },
        {
          name: 'deploy-pvc.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  replicas: 1\n  strategy:\n    type: Recreate\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        volumeMounts:\n        - name: data\n          mountPath: /data\n      volumes:\n      - name: data\n        persistentVolumeClaim:\n          claimName: tugboat-data',
          notes: [
            [
              'type: Recreate',
              'Stop the old pod before starting the new one, so the RWO disk is free to attach.',
            ],
            [
              'claimName: tugboat-data',
              'The only change from the emptyDir version: point the volume at a claim.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'See the storage class kind gives you.',
          code: 'cd ~/kube-quest/module_05_storage\nkubectl get storageclass',
          output:
            'NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      DEFAULT\nstandard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   true',
        },
        {
          text: 'Create «pvc.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'pvc.yaml',
        },
        {
          text: 'Create the claim.',
          code: 'kubectl apply -f pvc.yaml && kubectl get pvc',
          output:
            'NAME           STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS\ntugboat-data   Pending                                      standard',
          predict: {
            prompt:
              'You apply the PVC and check it right away, before any pod uses it. What status?',
            options: [
              'Pending: WaitForFirstConsumer waits for a pod before creating the volume',
              'Bound',
              'Failed',
              'Available',
            ],
            answers: [0],
            why: 'Pending is normal here. The provisioner waits to learn which node the pod lands on, then creates the volume there.',
          },
        },
        {
          text: 'Create «deploy-pvc.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'deploy-pvc.yaml',
        },
        {
          text: 'Switch tugboat to the claim. Now the PVC binds and a PV appears.',
          code: 'kubectl apply -f deploy-pvc.yaml && kubectl rollout status deployment/tugboat\nkubectl get pvc,pv',
        },
        {
          text: 'Count, then destroy the pod and restart the whole Deployment.',
          code: 'for i in 1 2 3; do curl -s localhost:30080; done\nkubectl delete pod -l app=tugboat && kubectl rollout status deployment/tugboat\nkubectl rollout restart deployment/tugboat && kubectl rollout status deployment/tugboat\ncurl -s localhost:30080',
          output: '… visits 4 (file /data/visits)',
        },
        {
          text: "Where is the disk physically? In kind it's a folder inside a node container.",
          code: "NODE=$(kubectl get pod -l app=tugboat -o jsonpath='{.items[0].spec.nodeName}')\ndocker exec $NODE sh -c 'ls /var/local-path-provisioner && cat /var/local-path-provisioner/*/visits'",
          output: 'pvc-3f2a…_default_tugboat-data\n4',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'A PVC with a WaitForFirstConsumer storage class shows Pending right after you create it. What does that mean?',
          options: [
            "It's waiting for a pod that uses it, so the volume can be created where the pod runs",
            'The storage class is broken',
            'The cluster is out of disk',
            'It needs a cluster administrator to approve it',
          ],
          answers: [0],
          why: "Delaying binding until a pod exists avoids creating a disk in one zone (or on one node) and then scheduling the pod somewhere it can't reach.",
        },
      ],
    },
    {
      slug: 'statefulsets',
      title: 'StatefulSets: databases with names',
      pain: 'Put Postgres in a Deployment with 2 replicas and both pods fight over one disk, get random names and start in any order. Databases need identity.',
      fix: 'So you use a **StatefulSet**: stable names (pg-0, pg-1), a dedicated disk per replica, ordered start-up, and a stable DNS name for each pod through a headless Service.',
      body: "- «volumeClaimTemplates» creates one PVC per replica: «data-pg-0», «data-pg-1»…\n- A headless Service («clusterIP: None») gives each pod a DNS name: «pg-0.pg.default.svc.cluster.local».\n- Pods start in order (0, then 1…) and update in reverse order.\n- Deleting or scaling down a StatefulSet keeps its PVCs by default, so data isn't lost by accident. You delete them yourself.\n- Setting «PGDATA» to a subfolder avoids a classic crash on cloud disks, whose root contains a «lost+found» folder that makes Postgres refuse to initialise.",
      note: '**A StatefulSet is not replication.** pg-1 is a second, empty Postgres with its own disk; nothing copies data between them. Real high availability needs an operator such as CloudNativePG, and for most production data on Google Cloud a managed database (Cloud SQL, AlloyDB) is less work.',
      files: [
        {
          name: 'pg.yaml',
          code: 'apiVersion: v1\nkind: Secret\nmetadata:\n  name: pg-secret\nstringData:\n  POSTGRES_PASSWORD: harbor-pass\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: pg\nspec:\n  clusterIP: None\n  selector:\n    app: pg\n  ports:\n  - port: 5432\n---\napiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: pg\nspec:\n  serviceName: pg\n  replicas: 1\n  selector:\n    matchLabels:\n      app: pg\n  template:\n    metadata:\n      labels:\n        app: pg\n    spec:\n      containers:\n      - name: postgres\n        image: postgres:17\n        ports:\n        - containerPort: 5432\n        env:\n        - name: POSTGRES_PASSWORD\n          valueFrom:\n            secretKeyRef:\n              name: pg-secret\n              key: POSTGRES_PASSWORD\n        - name: PGDATA\n          value: /var/lib/postgresql/data/pgdata\n        volumeMounts:\n        - name: data\n          mountPath: /var/lib/postgresql/data\n  volumeClaimTemplates:\n  - metadata:\n      name: data\n    spec:\n      accessModes: ["ReadWriteOnce"]\n      resources:\n        requests:\n          storage: 1Gi',
          notes: [
            [
              'clusterIP: None',
              'Headless: DNS returns pod IPs, and each pod gets its own name like pg-0.pg.',
            ],
            [
              'serviceName: pg',
              'Ties the StatefulSet to the headless Service for those per-pod names.',
            ],
            [
              'secretKeyRef:',
              'The password comes from the Secret, not the YAML of the StatefulSet.',
            ],
            [
              'PGDATA',
              "Keep the data in a subfolder so a lost+found folder on a cloud disk doesn't block initdb.",
            ],
            ['volumeClaimTemplates:', 'A PVC per replica, named data-pg-0, data-pg-1 …'],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «pg.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'pg.yaml',
        },
        {
          text: 'Apply it and watch pg-0 start (the first run pulls the postgres image).',
          code: 'kubectl apply -f pg.yaml\nkubectl get pods -l app=pg -w',
        },
        {
          text: 'Create a table and some cargo.',
          code: "kubectl exec pg-0 -- psql -U postgres -c \"create table cargo(id serial primary key, item text); insert into cargo(item) values ('spices'),('tea'),('silk');\"",
          output: 'CREATE TABLE\nINSERT 0 3',
        },
        {
          text: 'Delete the pod. It comes back with the same name and the same disk.',
          code: 'kubectl delete pod pg-0 && kubectl wait --for=condition=Ready pod/pg-0 --timeout=120s\nkubectl exec pg-0 -- psql -U postgres -c "select * from cargo;"',
          output: ' id |  item\n----+--------\n  1 | spices\n  2 | tea\n  3 | silk',
        },
        {
          text: 'Scale to two replicas.',
          code: 'kubectl scale statefulset pg --replicas=2 && kubectl wait --for=condition=Ready pod/pg-1 --timeout=180s\nkubectl exec pg-1 -- psql -U postgres -c "select * from cargo;"\nkubectl get pvc',
          output:
            'ERROR:  relation "cargo" does not exist\nNAME        STATUS   VOLUME     CAPACITY\ndata-pg-0   Bound    pvc-…      1Gi\ndata-pg-1   Bound    pvc-…      1Gi',
          predict: {
            prompt: 'You scale to 2 and query the cargo table on pg-1. What happens?',
            options: [
              'Error: relation "cargo" does not exist. pg-1 has its own empty disk',
              'It returns the same three rows',
              'It returns rows after a short replication delay',
              'pg-1 refuses to start because pg-0 owns the data',
            ],
            answers: [0],
            why: "Each replica gets its own PVC and its own empty database. Copying data between them is the database's job, not the StatefulSet's.",
          },
        },
        {
          text: 'Each pod has a stable DNS name through the headless Service.',
          code: 'kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- nslookup pg-0.pg',
        },
        {
          text: 'Scale back to 1. The PVC for pg-1 stays until you delete it.',
          code: 'kubectl scale statefulset pg --replicas=1\nkubectl get pvc\nkubectl delete pvc data-pg-1',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'You scale a Postgres StatefulSet from 1 to 2 replicas. What does the new pod contain?',
          options: [
            'An empty database on its own new volume',
            "A copy of pg-0's data",
            "A read-only view of pg-0's volume",
            'Nothing until you configure a replication Secret',
          ],
          answers: [0],
          why: 'StatefulSets provide identity and storage per replica. Replication is something the database (or an operator) has to set up.',
        },
      ],
    },
  ],
  mission: {
    title: 'Cure the amnesia',
    brief:
      "Make tugboat's counter survive anything short of deleting its claim, and find the limit of node-local disks.",
    tasks: [
      'tugboat uses a PVC with strategy Recreate and the counter survives pod deletion and a rollout restart',
      'Find the folder holding the counter inside the right node container',
      'Drain the node tugboat runs on (kubectl drain NODE --ignore-daemonsets --delete-emptydir-data) and explain why the replacement pod stays Pending',
      'Uncordon the node and see tugboat come back with its count intact',
      'pg-0 keeps its rows across a pod deletion',
    ],
    hint: "kind's local-path volumes live on one node, so the PV has node affinity. A cloud disk (GKE Persistent Disk) can reattach to another node in the same zone instead.",
    solution:
      "NODE=$(kubectl get pod -l app=tugboat -o jsonpath='{.items[0].spec.nodeName}')\nkubectl drain $NODE --ignore-daemonsets --delete-emptydir-data\nkubectl get pods -l app=tugboat           # Pending\nkubectl describe pod -l app=tugboat | grep -i affinity\n#   … 1 node(s) had volume node affinity conflict …\nkubectl uncordon $NODE\nkubectl get pods -l app=tugboat -w        # Running again on the same node\ncurl -s localhost:30080                   # count continues",
  },
  cleanup:
    'kubectl delete deployment tugboat --ignore-not-found\nkubectl delete svc tugboat --ignore-not-found\nkubectl delete pvc tugboat-data --ignore-not-found\nkubectl delete -f pg.yaml --ignore-not-found\nkubectl delete pvc data-pg-0 --ignore-not-found',
};
