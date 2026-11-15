/**
 * Port 12: Data Platforms. Spark, Airflow and batch on the cluster. Written for this course; it is not in the Helmsman page. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'data',
  number: 12,
  title: 'Data Platforms',
  tag: 'Spark, Airflow and batch on the cluster',
  hue: 6,
  dir: 'module_12_data_platforms',
  story:
    'Thursday. The data team wants off its always-on Hadoop cluster. They ask you one question: can Spark and Airflow run on the same Kubernetes cluster as tugboat, and pay only while a job runs? Today you teach the cluster a new object, follow a Spark driver as it asks for executor pods, run Airflow tasks as pods, and keep batch work away from the web tier.',
  lessons: [
    {
      slug: 'operators-crds',
      title: 'Operators and CRDs: teach the cluster new objects',
      pain: 'A Deployment knows how to keep a web app alive. It knows nothing about a Spark job, a Kafka cluster or a Postgres failover. You end up with a wiki page of manual steps for each one.',
      fix: 'So you add a **CustomResourceDefinition** and an **operator**. The CRD gives the API a new kind, such as «SparkApplication». The operator is a controller that watches that kind and does the manual steps for you.',
      body: 'Everything you built so far followed one pattern: you store the desired state in the API, and a controller makes the cluster match it. An operator is the same pattern for software that Kubernetes does not know.\n\n**CRD** → adds → **A new kind** → you create → **A custom resource** → watched by → **The operator** → creates → **Pods, Services, Jobs**\n\n- A **CRD** is only a schema. It tells the API server to store and validate objects of a new kind. Nothing runs because of a CRD alone.\n- A **custom resource** is one object of that kind, such as one «SparkApplication».\n- An **operator** is a Deployment that runs a control loop: watch the custom resources, compare with the cluster, fix the difference, write «status».\n- The data tools you meet in interviews are operators: the **Spark operator** («SparkApplication»), **Strimzi** («Kafka», «KafkaTopic»), the **Flink Kubernetes operator** («FlinkDeployment») and **CloudNativePG** («Cluster»).\n\n### What a senior answer says\n\n- An operator encodes day-2 work: upgrades, failover, backup and scaling. A Helm chart only installs.\n- The CRD schema is your API. Version it («v1alpha1» to «v1») and validate it, because users will depend on it.\n- An operator needs RBAC for every object it creates. Read its ClusterRole before you install it.\n- Deleting a CRD deletes every object of that kind. Treat that command like «DROP TABLE».',
      note: '**A CRD is not an operator.** People say "install the CRD" when they mean both. If you apply a custom resource and nothing happens, check that the operator pod runs and read its logs. The API server accepted your object; nobody acted on it.',
      files: [
        {
          name: 'pipeline-crd.yaml',
          code: 'apiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: pipelines.data.kq.io\nspec:\n  group: data.kq.io\n  scope: Namespaced\n  names:\n    plural: pipelines\n    singular: pipeline\n    kind: Pipeline\n    shortNames: [pl]\n  versions:\n  - name: v1\n    served: true\n    storage: true\n    schema:\n      openAPIV3Schema:\n        type: object\n        required: [spec]\n        properties:\n          spec:\n            type: object\n            required: [image, rows]\n            properties:\n              image:\n                type: string\n              rows:\n                type: integer\n                minimum: 1\n    additionalPrinterColumns:\n    - name: Image\n      type: string\n      jsonPath: .spec.image\n    - name: Rows\n      type: integer\n      jsonPath: .spec.rows',
          notes: [
            ['name: pipelines.data.kq.io', 'Always plural name, a dot, then the group.'],
            [
              'scope: Namespaced',
              'Objects of this kind live in a namespace, like pods. The other choice is «Cluster».',
            ],
            ['shortNames: [pl]', 'Lets you type «kubectl get pl».'],
            [
              'openAPIV3Schema:',
              'The API server validates every object against this schema before it stores it.',
            ],
            ['required: [image, rows]', 'An object without these fields is refused.'],
            ['additionalPrinterColumns:', 'The extra columns that «kubectl get pipelines» prints.'],
          ],
        },
        {
          name: 'pipeline.yaml',
          code: 'apiVersion: data.kq.io/v1\nkind: Pipeline\nmetadata:\n  name: nightly-load\nspec:\n  image: tugboat:v1\n  rows: 1200',
          notes: [
            ['apiVersion: data.kq.io/v1', 'The group and version from the CRD.'],
            ['kind: Pipeline', 'The new kind. The API server knows it now.'],
          ],
        },
        {
          name: 'reconcile.sh',
          code: '#!/usr/bin/env bash\n# One pass of a control loop: for every Pipeline, make sure a Job exists.\nfor name in $(kubectl get pipelines -o jsonpath=\'{.items[*].metadata.name}\'); do\n  if kubectl get job "$name" >/dev/null 2>&1; then\n    echo "pipeline/$name: job exists, nothing to do"\n    continue\n  fi\n  image=$(kubectl get pipeline "$name" -o jsonpath=\'{.spec.image}\')\n  rows=$(kubectl get pipeline "$name" -o jsonpath=\'{.spec.rows}\')\n  kubectl create job "$name" --image="$image" -- python -c "print(\'loaded $rows rows\')"\ndone',
          notes: [
            ['kubectl get pipelines', 'Observe: read the desired state.'],
            ['kubectl get job "$name"', 'Compare: does the real thing exist?'],
            [
              'kubectl create job',
              'Act: fix the difference. A real operator does this in Go or Python, and runs it on every change.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Set up the folder of this port.',
          code: 'mkdir -p ~/kube-quest/module_12_data_platforms && cd ~/kube-quest/module_12_data_platforms',
        },
        {
          text: 'Create «pipeline-crd.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'pipeline-crd.yaml',
        },
        {
          text: 'Apply the CRD, then ask the API what it knows about the new kind.',
          code: 'kubectl apply -f pipeline-crd.yaml\nkubectl api-resources --api-group=data.kq.io\nkubectl explain pipeline.spec',
          output:
            'NAME        SHORTNAMES   APIVERSION      NAMESPACED   KIND\npipelines   pl           data.kq.io/v1   true         Pipeline',
        },
        {
          text: 'Create «pipeline.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'pipeline.yaml',
        },
        {
          text: 'Create one Pipeline.',
          predict: {
            prompt: 'You apply «pipeline.yaml». The API server accepts it. How many pods start?',
            options: [
              'None. The object is stored, and no controller watches it',
              'One pod that runs the image in «spec.image»',
              'One Job with one pod',
              'The apply fails, because Kubernetes has no Pipeline controller',
            ],
            answers: [0],
            why: 'A CRD is only a schema. The API server stores and validates the object. Something must watch the kind and act, and you have not built that yet.',
          },
          code: 'kubectl apply -f pipeline.yaml\nkubectl get pipelines\nkubectl get pods',
          output:
            'NAME           IMAGE        ROWS\nnightly-load   tugboat:v1   1200\nNo resources found in default namespace.',
        },
        {
          text: 'Break the schema. Ask for zero rows, which the CRD forbids.',
          breakIt: true,
          code: 'kubectl patch pipeline nightly-load --type=merge -p \'{"spec":{"rows":0}}\'',
          output:
            'The Pipeline "nightly-load" is invalid: spec.rows: Invalid value: 0: spec.rows in body should be greater than or equal to 1',
        },
        {
          text: 'Create «reconcile.sh». It is one pass of a control loop, in shell.',
          file: 'reconcile.sh',
        },
        {
          text: 'Be the operator. Run one pass, read the logs of the Job, then run it again. The second pass changes nothing: the loop is idempotent.',
          code: 'bash reconcile.sh\nkubectl wait --for=condition=complete job/nightly-load --timeout=60s\nkubectl logs job/nightly-load\nbash reconcile.sh',
          output:
            'job.batch/nightly-load created\njob.batch/nightly-load condition met\nloaded 1200 rows\npipeline/nightly-load: job exists, nothing to do',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'You apply a «SparkApplication» and «kubectl get sparkapplications» lists it. No driver pod appears after five minutes. What do you check first?',
          options: [
            'That the Spark operator pod runs, and what its logs say',
            'That the CRD has the «v1» version',
            'That the node has enough CPU for the driver',
            'That the image exists in the registry',
          ],
          answers: [0],
          why: 'The API server stored the object, so the CRD works. The operator creates the driver pod. With no pod and no events on the object, the operator is down, or it does not watch that namespace.',
        },
      ],
    },
    {
      slug: 'spark-on-kubernetes',
      title: 'Spark on Kubernetes: a driver that asks for pods',
      pain: "The Hadoop cluster runs 40 nodes all day for jobs that run four hours a night. Each team wants a different Spark version, and one team's shuffle fills the disks of all the others.",
      fix: 'So you run Spark with **Kubernetes as the cluster manager**. Each job gets its own driver pod. The driver asks the API server for executor pods, and all of them go away when the job ends.',
      body: "Spark needs a cluster manager to give it executors. On Hadoop that is YARN. On Kubernetes it is the API server, and there is no long-running Spark cluster at all.\n\n**spark-submit** → creates → **Driver pod** → asks the API for → **Executor pods** → job ends → **All pods gone**\n\n- «spark-submit --master k8s://https://HOST --deploy-mode cluster» creates the **driver pod**. Your laptop can disconnect after that.\n- The driver creates the **executor pods** itself. So its ServiceAccount needs RBAC to create and delete pods, Services and ConfigMaps in its namespace.\n- The driver **owns** the executors. Delete the driver pod, and garbage collection removes every executor.\n- The image carries the Spark version and your dependencies. Two teams can run two Spark versions side by side.\n\n### Sizing a pod for the JVM\n\n| Spark setting | What Kubernetes sees |\n|---|---|\n| «spark.executor.memory» plus «spark.executor.memoryOverhead» | The memory request and limit of the executor pod |\n| «spark.executor.cores» | The CPU request, unless «spark.kubernetes.executor.request.cores» sets it |\n| «spark.kubernetes.executor.limit.cores» | The CPU limit. Not set by default |\n| «spark.executor.instances» | How many executor pods the driver asks for |\n\nThe overhead is 10% of the executor memory by default, and at least 384 MiB. PySpark and off-heap memory live in the overhead. An executor that goes over the pod limit is **OOMKilled** with exit code 137, and the fix is more «memoryOverhead», not more heap.\n\n### Dynamic allocation and spot nodes\n\n- Kubernetes has no external shuffle service. Set «spark.dynamicAllocation.shuffleTracking.enabled=true», so Spark keeps an executor while it holds shuffle data that a stage still needs.\n- Run **executors on spot nodes** and the **driver on a regular node**. A lost executor costs a retry. A lost driver costs the whole job.\n- Turn on executor decommissioning («spark.decommission.enabled=true»), so an executor moves its shuffle blocks when the node gets a termination notice.\n- Shuffle writes to the pod's local directories. That is an «emptyDir» by default, so a big shuffle can fill the node's disk and get the pod evicted.\n\n### The Spark operator\n\nWith plain «spark-submit», a job is a command that somebody ran. The **Spark operator** makes it an object: you apply a «SparkApplication», and the operator runs the submit, retries on failure and writes the state to «status». A «ScheduledSparkApplication» adds a cron schedule. That gives you Git review, GitOps sync and «kubectl get» for jobs.\n\n### What a senior answer says\n\n- State the trade: no idle cluster and full isolation, in exchange for pod start time and no shuffle service.\n- Size the pod from heap plus overhead, and name exit code 137 as the overhead signal.\n- Put the driver on stable capacity and the executors on spot capacity.\n- For many jobs, add a batch scheduler such as **YuniKorn** or **Volcano** for queues and gang scheduling, so a job does not start with half its executors.",
      docker: [
        [
          'docker run spark-master, then docker run spark-worker',
          'No standing cluster: the driver pod asks the API for executors',
        ],
        [
          'docker compose up --scale worker=4',
          '«spark.executor.instances=4», or dynamic allocation',
        ],
      ],
      files: [
        {
          name: 'spark-pi.yaml',
          code: 'apiVersion: sparkoperator.k8s.io/v1beta2\nkind: SparkApplication\nmetadata:\n  name: spark-pi\nspec:\n  type: Scala\n  mode: cluster\n  image: apache/spark:4.0.1\n  mainClass: org.apache.spark.examples.SparkPi\n  mainApplicationFile: local:///opt/spark/examples/jars/spark-examples.jar\n  arguments: ["1000"]\n  sparkVersion: 4.0.1\n  restartPolicy:\n    type: OnFailure\n    onFailureRetries: 2\n  driver:\n    cores: 1\n    memory: 512m\n    serviceAccount: spark\n  executor:\n    instances: 2\n    cores: 1\n    memory: 512m\n    memoryOverhead: 384m',
          notes: [
            [
              'kind: SparkApplication',
              "A custom resource. It needs the Spark operator from the last lesson's pattern. You read this file here; you do not apply it.",
            ],
            ['mode: cluster', 'The driver runs in a pod, not on the machine that submits.'],
            [
              'mainApplicationFile: local://',
              '«local://» means the file is already inside the image.',
            ],
            ['restartPolicy:', 'The operator resubmits a failed job. Plain spark-submit does not.'],
            ['serviceAccount: spark', 'The identity the driver uses to create executor pods.'],
            ['memoryOverhead: 384m', "Added to «memory» to make the pod's memory limit."],
          ],
        },
      ],
      lab: [
        {
          text: 'Give the driver an identity that may create pods in this namespace. The «edit» role is wide; it is fine for a lab.',
          code: 'cd ~/kube-quest/module_12_data_platforms\nkubectl create serviceaccount spark\nkubectl create rolebinding spark-edit --clusterrole=edit --serviceaccount=default:spark',
        },
        {
          text: 'In a **second terminal**, watch the pods.',
          secondTerminal: true,
          code: 'kubectl get pods -w',
        },
        {
          text: 'Submit SparkPi from inside the cluster. The first run pulls the Spark image, which is about 1 GB, so give it a few minutes.',
          predict: {
            prompt: 'The submit asks for 2 executors. Which pods will you see while the job runs?',
            options: [
              'The submit pod, one driver pod, and two executor pods that the driver created',
              'One pod that holds the driver and both executors',
              'A Deployment with three replicas',
              'Two executor pods only; the driver stays in the submit pod',
            ],
            answers: [0],
            why: 'In cluster mode the submit pod only creates the driver pod. The driver then asks the API server for each executor pod.',
          },
          code: 'kubectl run spark-submit --rm -i --restart=Never --image=apache/spark:4.0.1 \\\n  --overrides=\'{"spec":{"serviceAccountName":"spark"}}\' -- \\\n  /opt/spark/bin/spark-submit \\\n  --master k8s://https://kubernetes.default.svc \\\n  --deploy-mode cluster --name spark-pi \\\n  --class org.apache.spark.examples.SparkPi \\\n  --conf spark.executor.instances=2 \\\n  --conf spark.executor.memory=512m \\\n  --conf spark.kubernetes.container.image=apache/spark:4.0.1 \\\n  --conf spark.kubernetes.authenticate.driver.serviceAccountName=spark \\\n  local:///opt/spark/examples/jars/spark-examples.jar 1000',
          output:
            'spark-submit                     1/1   Running\nspark-pi-…-driver                1/1   Running\nspark-pi-…-exec-1                1/1   Running\nspark-pi-…-exec-2                1/1   Running\n# then the executors terminate and the driver shows Completed',
        },
        {
          text: 'Read the result from the driver, and see who owned the executors.',
          code: 'DRIVER=$(kubectl get pod -l spark-role=driver -o jsonpath=\'{.items[0].metadata.name}\')\nkubectl logs "$DRIVER" | grep "Pi is roughly"\nkubectl get pod "$DRIVER" -o jsonpath=\'{.spec.containers[0].resources}{"\\n"}\'',
          output:
            'Pi is roughly 3.14…\n{"limits":{"memory":"1408Mi"},"requests":{"cpu":"1","memory":"1408Mi"}}',
        },
        {
          text: 'Look at the numbers. The driver asked for 1 GiB of heap by default, and Kubernetes saw 1408 Mi: the heap plus 384 Mi of overhead. Then delete the finished driver.',
          code: 'kubectl delete pod -l spark-role=driver',
        },
        {
          text: 'Create «spark-pi.yaml» and read it. It is the same job as an object for the Spark operator.',
          file: 'spark-pi.yaml',
        },
      ],
      checks: [
        {
          type: 'order',
          prompt: 'Put a Spark job on Kubernetes in order.',
          steps: [
            'spark-submit asks the API server for a driver pod',
            'The scheduler places the driver pod on a node',
            'The driver asks the API server for executor pods',
            'The executors register with the driver and run tasks',
            'The driver finishes, and its executor pods are deleted',
          ],
          why: 'The driver is the only part that talks to the API server about executors. That is why its ServiceAccount needs RBAC on pods.',
        },
      ],
    },
    {
      slug: 'airflow-on-kubernetes',
      title: 'Airflow on Kubernetes: one pod per task',
      pain: 'Four Celery workers run all day for a schedule that is busy at 02:00 and idle at noon. One task needs pandas 1 and another needs pandas 2, and both must fit in the same worker image.',
      fix: 'So you run Airflow with the **KubernetesExecutor**: each task runs in its own pod and leaves when it ends. For a task with its own dependencies, the **KubernetesPodOperator** runs any image you name.',
      body: "An Airflow executor decides where a task runs. On Kubernetes you have three common choices.\n\n| Executor | Where a task runs | Good for | Cost |\n|---|---|---|---|\n| **KubernetesExecutor** | A new pod per task | Spiky schedules, isolation per task | Pod start time on every task, often 10 to 60 seconds |\n| **CeleryExecutor** | Long-lived worker pods | Many short tasks | Workers run all day, unless KEDA scales them |\n| **LocalExecutor** | Inside the scheduler pod | Small installs | No isolation, one pod to size |\n\n- With the KubernetesExecutor, the **scheduler** creates each worker pod through the API server. So the scheduler's ServiceAccount needs RBAC on pods.\n- The pod comes from a **pod template** («pod_template_file»). A task can change it with «executor_config», for example to ask for more memory.\n- The **KubernetesPodOperator** is a task that starts a second pod with any image. Use it when the work is not Python, or needs its own libraries. It works with every executor.\n- Airflow can run more than one executor at a time, so short tasks can use Celery while heavy tasks get their own pod.\n\n### Three things that break first\n\n- **Logs.** The task pod is deleted when the task ends, and its logs go with it. Turn on **remote logging** to object storage (GCS or S3).\n- **DAG files.** Every pod needs the same DAG code. Bake it into the image, or sync it with a **git-sync** sidecar.\n- **Database connections.** Every task pod opens connections to the metadata database. Put **PgBouncer** in front of Postgres.\n\n### Airflow orchestrates, it does not compute\n\nA task pod should start work somewhere else: a «SparkApplication», a BigQuery job, a dbt run in its own pod. Size task pods small, and give the heavy work its own requests and limits.\n\n### What a senior answer says\n\n- Choose the executor from the task profile: many short tasks favour Celery, and few heavy or isolated tasks favour pods.\n- Name the three operational needs: remote logs, DAG delivery and connection pooling.\n- Set requests on the pod template, and a ResourceQuota on the namespace, so a backfill cannot take every node.\n- Install with the official Helm chart and keep its values in Git.",
      note: '**The KubernetesExecutor and the KubernetesPodOperator are different things.** The executor decides where every Airflow task runs. The operator is one task type that starts a pod. With both, one task uses two pods: the worker pod and the pod it starts.',
      files: [
        {
          name: 'task-pod.yaml',
          code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  generateName: orders-etl-\n  labels:\n    dag_id: orders_etl\n    run_id: manual-2026-11-14\nspec:\n  restartPolicy: Never\n  containers:\n  - name: base\n    image: tugboat:v1\n    command: ["python", "-c", "import os; print(\'task\', os.environ[\'TASK\'], \'done\')"]\n    env:\n    - name: TASK\n      value: extract\n    resources:\n      requests:\n        cpu: 100m\n        memory: 64Mi',
          notes: [
            [
              'generateName: orders-etl-',
              'The API server adds a random suffix, so every task try gets a new pod name.',
            ],
            [
              'dag_id: orders_etl',
              'The executor labels each pod with the DAG, the task and the run. You find pods by label, not by name.',
            ],
            [
              'restartPolicy: Never',
              'Airflow owns the retries. The kubelet must not restart the task.',
            ],
            ['name: base', 'The executor expects the main container to have this name.'],
            [
              'requests:',
              'What the scheduler reserves for the task. A pod template without requests can overload a node.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «task-pod.yaml». It has the shape of the pod that the KubernetesExecutor creates for one task.',
          file: 'task-pod.yaml',
        },
        {
          text: 'Be the executor. Start one pod for each of three tasks. «kubectl create» is needed here, because «generateName» does not work with «apply».',
          code: 'cd ~/kube-quest/module_12_data_platforms\nfor task in extract transform load; do\n  sed "s/value: extract/value: $task/" task-pod.yaml | kubectl create -f -\ndone\nkubectl get pods -l dag_id=orders_etl',
          output:
            'NAME               READY   STATUS      RESTARTS   AGE\norders-etl-7hx2p   0/1     Completed   0          6s\norders-etl-m4kd9   0/1     Completed   0          5s\norders-etl-zq8wv   0/1     Completed   0          5s',
        },
        {
          text: 'Read the logs of the whole run with one label selector.',
          code: 'kubectl logs -l dag_id=orders_etl --prefix',
          output:
            '[pod/orders-etl-7hx2p/base] task extract done\n[pod/orders-etl-m4kd9/base] task transform done\n[pod/orders-etl-zq8wv/base] task load done',
        },
        {
          text: 'Now do what the executor does after a task: delete the pods.',
          breakIt: true,
          predict: {
            prompt:
              'The pods are deleted. An engineer opens the task log in the Airflow UI the next morning. What do they see, with no remote logging?',
            options: [
              'Nothing. The log lived in the pod and went with it',
              'The full log, because the kubelet keeps logs for 7 days',
              'The log, because the scheduler copies it before the delete',
              "The last 100 lines from the node's log file",
            ],
            answers: [0],
            why: "A container's log is a file on the node that belongs to the pod. When the pod is deleted, the file is removed. Remote logging uploads the log to object storage when the task ends.",
          },
          code: 'kubectl delete pods -l dag_id=orders_etl\nkubectl logs -l dag_id=orders_etl',
          output:
            'pod "orders-etl-7hx2p" deleted\npod "orders-etl-m4kd9" deleted\npod "orders-etl-zq8wv" deleted\nNo resources found in default namespace.',
        },
        {
          text: 'Optional and heavy: install real Airflow with the official chart. It needs about 4 GB of free memory and takes several minutes. Then trigger any example DAG in the UI and watch a pod appear for each task.',
          code: 'helm repo add apache-airflow https://airflow.apache.org && helm repo update\nhelm install airflow apache-airflow/airflow -n airflow --create-namespace \\\n  --set executor=KubernetesExecutor --timeout 15m\nkubectl get pods -n airflow -w',
        },
        {
          text: 'If you installed it, remove it again.',
          code: 'helm uninstall airflow -n airflow\nkubectl delete namespace airflow',
        },
      ],
      checks: [
        {
          type: 'match',
          prompt: 'Match each need to the Airflow piece that meets it.',
          pairs: [
            ['Every task in its own short-lived pod', 'KubernetesExecutor'],
            ['One task that runs a non-Python image', 'KubernetesPodOperator'],
            ['Task logs that outlive the pod', 'Remote logging to object storage'],
            ['The same DAG code in every pod', 'git-sync, or DAGs baked into the image'],
          ],
          why: 'The executor is a setting for the whole install. The operator is a choice for one task. Logs and DAG files are the two things a short-lived pod cannot keep by itself.',
        },
      ],
    },
    {
      slug: 'batch-scheduling',
      title: 'Batch next to serving: taints, priority and quotas',
      pain: 'The nightly backfill starts 200 executor pods. They land on the same nodes as tugboat, take the CPU, and the web tier slows down while the pager rings.',
      fix: "So you give batch work its own lane: a **tainted node pool** that only batch pods tolerate, a low **PriorityClass**, and a **ResourceQuota** for each team's namespace.",
      body: 'The scheduler places a pod on any node with room. Three tools let you say where batch work may go, who waits, and how much one team may take.\n\n| Tool | It answers | Set on |\n|---|---|---|\n| **Taint** and **toleration** | Which pods may use these nodes? | The node, and the pods you let in |\n| **nodeSelector** or node affinity | Which nodes must this pod use? | The pod |\n| **PriorityClass** | Who goes first, and who is evicted when the cluster is full? | The pod |\n| **ResourceQuota** | How much may one namespace ask for in total? | The namespace |\n| **LimitRange** | What does a pod get when it sets no requests? | The namespace |\n\n- A taint **repels**. A toleration only **permits**. A pod with a toleration can still land on another node, so pair it with a «nodeSelector» to keep batch pods on the batch pool.\n- On GKE, Spot nodes carry the label «cloud.google.com/gke-spot=true». They cost much less and can be taken back at short notice. Use them for work that can retry.\n- A high-priority pod that cannot be placed can **preempt** lower-priority pods. Give serving a high class and batch a low class.\n- A quota on «requests.cpu» refuses every pod that sets no CPU request. Add a LimitRange with defaults in the same namespace.\n\n### Make the Job itself safe\n\n| Field | What it does |\n|---|---|\n| «backoffLimit» | How many times a failed pod is retried |\n| «activeDeadlineSeconds» | Stops a job that hangs |\n| «ttlSecondsAfterFinished» | Deletes the finished Job and its pods after this time |\n| «podFailurePolicy» | Fails fast on a bug, and does not count a spot eviction as a failure |\n\n### What a senior answer says\n\n- Separate by node pool first, then by priority, then by quota. Each one catches what the one before it misses.\n- A toleration alone is not placement. Say "taint plus selector".\n- Batch on spot needs idempotent tasks and retries, and the driver or the scheduler stays on regular nodes.\n- Quotas are per namespace, so one team per namespace is what makes them work.',
      files: [
        {
          name: 'priority.yaml',
          code: 'apiVersion: scheduling.k8s.io/v1\nkind: PriorityClass\nmetadata:\n  name: batch-low\nvalue: 100\npreemptionPolicy: Never\nglobalDefault: false\ndescription: Batch work that can wait.',
          notes: [
            [
              'value: 100',
              'Higher wins. Pods with no class have priority 0, unless a class is the global default.',
            ],
            ['preemptionPolicy: Never', 'These pods wait in the queue. They never evict others.'],
          ],
        },
        {
          name: 'backfill-job.yaml',
          code: 'apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: backfill\nspec:\n  backoffLimit: 2\n  activeDeadlineSeconds: 300\n  ttlSecondsAfterFinished: 120\n  template:\n    spec:\n      restartPolicy: Never\n      priorityClassName: batch-low\n      nodeSelector:\n        pool: batch\n      tolerations:\n      - key: workload\n        operator: Equal\n        value: batch\n        effect: NoSchedule\n      containers:\n      - name: backfill\n        image: tugboat:v1\n        command: ["python", "-c", "print(\'backfilled 30 days\')"]\n        resources:\n          requests:\n            cpu: 200m\n            memory: 64Mi',
          notes: [
            [
              'activeDeadlineSeconds: 300',
              'The Job is stopped after 5 minutes, even if a pod hangs.',
            ],
            ['ttlSecondsAfterFinished: 120', 'Finished Jobs clean themselves up.'],
            ['priorityClassName: batch-low', 'Serving pods with a higher class go first.'],
            ['nodeSelector:', 'The pod must go to a node with the label «pool=batch».'],
            ['tolerations:', 'The pod may use nodes with the taint «workload=batch:NoSchedule».'],
          ],
        },
        {
          name: 'quota.yaml',
          code: 'apiVersion: v1\nkind: ResourceQuota\nmetadata:\n  name: team-etl\n  namespace: team-etl\nspec:\n  hard:\n    pods: "2"\n    requests.cpu: "1"\n    requests.memory: 1Gi',
          notes: [
            ['pods: "2"', 'At most two pods at a time in the namespace.'],
            [
              'requests.cpu: "1"',
              'The sum of all CPU requests in the namespace. A pod with no CPU request is refused.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Make «kq-worker2» the batch pool: label it and taint it. Then start four tugboat pods.',
          predict: {
            prompt:
              'One of the two workers now has the taint «workload=batch:NoSchedule». Where do the four tugboat pods go?',
            options: [
              'All four go to «kq-worker», the only worker they tolerate',
              'Two go to each worker, as before',
              'They stay Pending until you remove the taint',
              'They go to the control-plane node',
            ],
            answers: [0],
            why: 'The tugboat pods have no toleration, so the tainted node refuses them. The scheduler still has one node that fits.',
          },
          code: 'cd ~/kube-quest/module_12_data_platforms\nkubectl label node kq-worker2 pool=batch\nkubectl taint node kq-worker2 workload=batch:NoSchedule\nkubectl create deployment tugboat --image=tugboat:v1 --replicas=4\nkubectl rollout status deployment tugboat\nkubectl get pods -l app=tugboat -o custom-columns=POD:.metadata.name,NODE:.spec.nodeName',
        },
        {
          text: 'Create «priority.yaml».',
          file: 'priority.yaml',
        },
        {
          text: 'Create «backfill-job.yaml».',
          file: 'backfill-job.yaml',
        },
        {
          text: 'Run the backfill. It has the toleration and the selector, so it lands on the batch node.',
          code: 'kubectl apply -f priority.yaml -f backfill-job.yaml\nkubectl wait --for=condition=complete job/backfill --timeout=90s\nkubectl get pods -l job-name=backfill -o custom-columns=POD:.metadata.name,NODE:.spec.nodeName,PRIORITY:.spec.priority',
          output: 'POD              NODE         PRIORITY\nbackfill-x7k2p   kq-worker2   100',
        },
        {
          text: 'Create «quota.yaml».',
          file: 'quota.yaml',
        },
        {
          text: 'Give a team a namespace with a quota of two pods, then ask for four.',
          breakIt: true,
          code: 'kubectl create namespace team-etl\nkubectl apply -f quota.yaml\nkubectl create deployment loader -n team-etl --image=tugboat:v1 --replicas=4\nkubectl set resources deployment loader -n team-etl --requests=cpu=100m,memory=64Mi\nsleep 10\nkubectl get deployment loader -n team-etl\nkubectl get events -n team-etl --field-selector reason=FailedCreate | tail -1',
          output:
            'NAME     READY   UP-TO-DATE   AVAILABLE\nloader   2/4     2            2\n… Error creating: pods "loader-…" is forbidden: exceeded quota: team-etl, requested: pods=1, used: pods=2, limited: pods=2',
        },
        {
          text: 'See what the quota counted.',
          code: 'kubectl describe resourcequota team-etl -n team-etl',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'The batch pool has the taint «workload=batch:NoSchedule». You add the matching toleration to the Spark executors, and nothing else. Where can they run?',
          options: [
            'On the batch pool and on every untainted node',
            'Only on the batch pool',
            'Only on untainted nodes',
            'Nowhere, until you also add a nodeSelector',
          ],
          answers: [0],
          why: "A toleration only removes a barrier. It does not attract the pod. To keep the executors on the batch pool, add a «nodeSelector» or node affinity for the pool's label.",
        },
      ],
    },
  ],
  mission: {
    title: 'A lane for the data team',
    brief:
      'Give the data team a namespace, a batch lane and a job object, so a backfill cannot hurt tugboat.',
    tasks: [
      'Namespace «team-etl» with a ResourceQuota of 3 pods and 1 CPU of requests',
      'Node «kq-worker2» labelled «pool=batch» and tainted «workload=batch:NoSchedule»',
      'PriorityClass «batch-low» with value 100 that never preempts',
      'A Job «backfill» in «team-etl» that runs only on the batch node, with «backoffLimit: 2» and «ttlSecondsAfterFinished: 120»',
      'Prove it: the pod of the Job ran on «kq-worker2», and a tugboat pod never does',
      'Clean up everything from this port',
    ],
    solution:
      "kubectl create namespace team-etl\nkubectl create quota team-etl -n team-etl --hard=pods=3,requests.cpu=1\nkubectl label node kq-worker2 pool=batch --overwrite\nkubectl taint node kq-worker2 workload=batch:NoSchedule --overwrite\nkubectl apply -f priority.yaml\nsed 's/name: backfill$/name: backfill\\n  namespace: team-etl/' backfill-job.yaml | kubectl apply -f -\nkubectl wait -n team-etl --for=condition=complete job/backfill --timeout=90s\nkubectl get pods -n team-etl -o custom-columns=POD:.metadata.name,NODE:.spec.nodeName\nkubectl get pods -l app=tugboat -o custom-columns=POD:.metadata.name,NODE:.spec.nodeName",
  },
  cleanup:
    'kubectl delete namespace team-etl --ignore-not-found\nkubectl delete job backfill nightly-load --ignore-not-found\nkubectl delete deployment tugboat --ignore-not-found\nkubectl delete priorityclass batch-low --ignore-not-found\nkubectl delete pipeline --all 2>/dev/null || true\nkubectl delete crd pipelines.data.kq.io --ignore-not-found\nkubectl delete pod -l spark-role=driver --ignore-not-found\nkubectl delete rolebinding spark-edit --ignore-not-found\nkubectl delete serviceaccount spark --ignore-not-found\nkubectl taint node kq-worker2 workload=batch:NoSchedule- || true\nkubectl label node kq-worker2 pool- || true',
};
