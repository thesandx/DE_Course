/**
 * Port 4: Config & Secrets. Same image, every environment. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'config',
  number: 4,
  title: 'Config & Secrets',
  tag: 'Same image, every environment',
  hue: 5,
  dir: 'module_04_config_secrets',
  story:
    'Thursday. Staging pointed at the production database because a connection string was baked into the image, and a rebuild for every environment made it easy to ship the wrong one. Today config moves out of the image, secrets get handled with care, and one base deploys to dev and prod.',
  lessons: [
    {
      slug: 'configmaps',
      title: 'ConfigMaps: config outside the image',
      pain: 'Config baked into the image means a rebuild for every environment, and sooner or later the staging value ships to production.',
      fix: 'So you use a **ConfigMap**: config lives outside the container and is injected at runtime, as environment variables or as files. The same image runs in dev, staging and prod.',
      body: "A ConfigMap is a set of key-value pairs (up to 1 MiB). Pods consume it three ways:\n\n| How | Looks like | Picks up changes? |\n|---|---|---|\n| «env.valueFrom.configMapKeyRef» | One env var from one key | No: only when the container restarts |\n| «envFrom.configMapRef» | Every key becomes an env var | No: only when the container restarts |\n| Volume mount | Each key becomes a file | Yes, within about a minute (not with «subPath») |\n\nEnvironment variables are copied into the process when it starts, so editing the ConfigMap doesn't reach a running container. Mounted files are symlinks the kubelet swaps atomically, so apps that re-read the file see the change. Set «immutable: true» on ConfigMaps that should never change; it protects them and lightens the API server's load.",
      docker: [
        ['docker run -e GREETING=…', 'env from a ConfigMap'],
        ['docker run --env-file app.env', 'envFrom'],
        ['docker run -v ./app.properties:/etc/…', 'A ConfigMap volume'],
      ],
      files: [
        {
          name: 'cm-deploy.yaml',
          code: 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: tugboat-config\ndata:\n  GREETING: "Namaste"\n  COLOR: "#0f766e"\n  app.properties: |\n    harbor=hyderabad\n    max_cargo_tons=1200\n    feature.dark_mode=true\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        env:\n        - name: GREETING\n          valueFrom:\n            configMapKeyRef:\n              name: tugboat-config\n              key: GREETING\n        - name: COLOR\n          valueFrom:\n            configMapKeyRef:\n              name: tugboat-config\n              key: COLOR\n        volumeMounts:\n        - name: config\n          mountPath: /etc/tugboat/config\n          readOnly: true\n      volumes:\n      - name: config\n        configMap:\n          name: tugboat-config\n          items:\n          - key: app.properties\n            path: app.properties',
          notes: [
            [
              'kind: ConfigMap',
              'Config as its own object, versioned and applied separately from the image.',
            ],
            ['app.properties: |', 'A whole file as one value. The | keeps line breaks.'],
            ['configMapKeyRef:', 'Pulls one key into one environment variable.'],
            [
              'mountPath: /etc/tugboat/config',
              'The volume shows up as a folder; each listed key becomes a file in it.',
            ],
            ['items:', 'Only mount app.properties, not GREETING and COLOR as files too.'],
          ],
        },
      ],
      lab: [
        {
          text: 'Set up the folder.',
          code: 'mkdir -p ~/kube-quest/module_04_config_secrets && cd ~/kube-quest/module_04_config_secrets',
        },
        {
          text: 'Create «cm-deploy.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'cm-deploy.yaml',
        },
        {
          text: "Apply it, forward a port in the second terminal, and read tugboat's view of its config.",
          code: 'kubectl apply -f cm-deploy.yaml\nkubectl rollout status deployment/tugboat\nkubectl port-forward deployment/tugboat 8080:8080 &\nsleep 2 && curl -s localhost:8080/config',
          output:
            '{\n  "pod": "tugboat-5c7f9d8b6-8kq2x",\n  "env": {"APP_VERSION": "v1", "GREETING": "Namaste", "COLOR": "#0f766e", "API_KEY": null},\n  "config_file": {"/etc/tugboat/config/app.properties": "harbor=hyderabad\\nmax_cargo_tons=1200\\nfeature.dark_mode=true\\n"},\n  "secret_files": {}\n}',
        },
        {
          text: 'Open http://localhost:8080 in Windows: the page is teal now, with no rebuild.',
          browser: true,
        },
        {
          text: 'Change both the greeting and the file.',
          code: 'kubectl patch configmap tugboat-config --type merge -p \'{"data":{"GREETING":"Vanakkam","app.properties":"harbor=chennai\\n"}}\'\nsleep 70\nkubectl exec deployment/tugboat -- cat /etc/tugboat/config/app.properties\ncurl -s localhost:8080/config | grep GREETING',
          output: 'harbor=chennai\n  "env": {"APP_VERSION": "v1", "GREETING": "Namaste", …',
          predict: {
            prompt:
              'You edit the ConfigMap and wait a minute without restarting anything. What has changed inside the pods?',
            options: [
              'The mounted file has the new content, but GREETING is still the old value',
              'Both changed',
              'Neither changed until you restart',
              'The pods restarted automatically',
            ],
            answers: [0],
            why: 'Mounted ConfigMap files are refreshed by the kubelet. Environment variables were copied into the process at start, so they stay frozen until the container restarts.',
          },
        },
        {
          text: 'Restart the pods to pick up the env var. Port-forward dies with the old pod, so restart it too.',
          code: 'kubectl rollout restart deployment/tugboat && kubectl rollout status deployment/tugboat\nkill %1; kubectl port-forward deployment/tugboat 8080:8080 &\nsleep 2 && curl -s localhost:8080',
          output:
            'Vanakkam from tugboat v1 | pod tugboat-6d9b… | path / | visits 1 (file /data/visits)',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'Which consumption method picks up a ConfigMap edit without restarting the container?',
          options: [
            'A volume mount without subPath',
            'envFrom',
            'env.valueFrom.configMapKeyRef',
            'A volume mount with subPath',
          ],
          answers: [0],
          why: 'Only regular volume mounts are refreshed in place. Env vars are fixed at process start, and subPath mounts are a copy that never updates.',
        },
      ],
    },
    {
      slug: 'secrets',
      title: 'Secrets: sensitive, but not magic',
      pain: "Your database password now sits in a ConfigMap, readable by anyone with basic kubectl access. That's not a mistake to fix later; it's a security incident.",
      fix: 'So you use a **Secret**: a separate object type with its own access controls, mounted only into the pods that need it.',
      body: '| Secret type | For |\n|---|---|\n| «Opaque» | Anything: passwords, API keys |\n| «kubernetes.io/tls» | A certificate and key for TLS |\n| «kubernetes.io/dockerconfigjson» | Credentials to pull from a private registry |\n\nIn YAML, «data» takes base64 values and «stringData» takes plain text (the API server encodes it for you). Prefer mounting secrets as files: environment variables leak into crash dumps, child processes and debug output more easily, and files can be rotated without a restart.',
      note: '**What a Secret actually protects.** By default a Secret is base64-encoded, not encrypted. Its safety comes from things around it: RBAC that limits who can «get secrets» (Port 07), encryption at rest in etcd (always on in GKE, and you can add Cloud KMS application-layer encryption), mounting it only where needed, and never committing it to Git. For real credentials, keep the source of truth in Google Secret Manager and sync it in with the Secret Manager add-on for GKE or the External Secrets Operator.',
      files: [
        {
          name: 'deploy-with-secret.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        env:\n        - name: GREETING\n          valueFrom:\n            configMapKeyRef:\n              name: tugboat-config\n              key: GREETING\n        volumeMounts:\n        - name: config\n          mountPath: /etc/tugboat/config\n          readOnly: true\n        - name: secret\n          mountPath: /etc/tugboat/secret\n          readOnly: true\n      volumes:\n      - name: config\n        configMap:\n          name: tugboat-config\n          items:\n          - key: app.properties\n            path: app.properties\n      - name: secret\n        secret:\n          secretName: tugboat-secret',
          notes: [
            ['- name: secret', 'The same deployment as before, plus a second volume.'],
            [
              'mountPath: /etc/tugboat/secret',
              'Each key in the Secret becomes a file here, readable only inside this pod.',
            ],
            [
              'secretName: tugboat-secret',
              "The pod won't start until this Secret exists in the same namespace.",
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Create the Secret imperatively, so its value never lands in a file in your folder.',
          code: 'cd ~/kube-quest/module_04_config_secrets\nkubectl create secret generic tugboat-secret --from-literal=API_KEY=sk-live-4f9a2c71',
        },
        {
          text: 'Look at it.',
          code: "kubectl get secret tugboat-secret -o yaml | grep -A1 '^data'",
          output: 'data:\n  API_KEY: c2stbGl2ZS00ZjlhMmM3MQ==',
          predict: {
            prompt: 'The YAML shows «API_KEY: c2stbGl2ZS00ZjlhMmM3MQ==». What is that?',
            options: [
              'The value in base64: encoded, not encrypted',
              "The value encrypted with the cluster's key",
              'A hash of the value',
              'A reference to the value stored elsewhere',
            ],
            answers: [0],
            why: 'Base64 is reversible by anyone. Treat read access to a Secret as read access to the password.',
          },
        },
        {
          text: 'Decode it. Anyone with «get secrets» permission can do this.',
          code: "kubectl get secret tugboat-secret -o jsonpath='{.data.API_KEY}' | base64 -d; echo",
          output: 'sk-live-4f9a2c71',
        },
        {
          text: 'Create «deploy-with-secret.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'deploy-with-secret.yaml',
        },
        {
          text: 'Apply it. tugboat masks the key when it reports its config.',
          code: 'kubectl apply -f deploy-with-secret.yaml && kubectl rollout status deployment/tugboat\nkill %1 2>/dev/null; kubectl port-forward deployment/tugboat 8080:8080 &\nsleep 2 && curl -s localhost:8080/config | grep -A2 secret_files',
          output: '  "secret_files": {\n    "API_KEY": "sk**************"\n  }',
        },
        {
          text: "The file inside the pod, and what «describe» does (and doesn't) reveal.",
          code: 'kubectl exec deployment/tugboat -- ls -la /etc/tugboat/secret\nkubectl describe secret tugboat-secret | tail -3',
          output: 'lrwxrwxrwx … API_KEY -> ..data/API_KEY\nData\n====\nAPI_KEY:  16 bytes',
        },
        {
          text: 'Break it: a Secret YAML with plain text under «data».',
          code: "cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: Secret\nmetadata:\n  name: oops\ndata:\n  PASSWORD: hunter2!\nEOF",
          output: 'Error from server (BadRequest): … illegal base64 data at input byte 7',
          breakIt: true,
        },
        {
          text: 'Use «stringData» for plain text instead, then delete the test Secret.',
          code: "cat <<'EOF' | kubectl apply -f -\napiVersion: v1\nkind: Secret\nmetadata:\n  name: oops\nstringData:\n  PASSWORD: hunter2!\nEOF\nkubectl delete secret oops",
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: "Which of these actually keeps a Secret away from people who shouldn't read it?",
          options: [
            "RBAC rules that don't grant get/list on secrets to them",
            'base64 encoding',
            'Mounting it as a file instead of an env var',
            'Setting immutable: true',
          ],
          answers: [0],
          why: "Encoding hides nothing, and how it's mounted only matters inside the pod. Access control on the API decides who can read the Secret object.",
        },
      ],
    },
    {
      slug: 'kustomize',
      title: 'Kustomize: one base, many environments',
      pain: 'Dev wants 1 replica and a debug greeting. Prod wants 3 replicas, v2 and a different welcome. Copy-pasted YAML per environment drifts apart within a week.',
      fix: 'So you use **Kustomize**, built into kubectl: one base, a small overlay per environment, and generated ConfigMaps whose names change with their content, so pods roll automatically when config changes.',
      body: "Kustomize never uses templates. It takes plain YAML and applies transformations: set a namespace, change an image tag, set replicas, merge patches, generate ConfigMaps and Secrets.\n\nThe trick that fixes the last lesson's restart problem: «configMapGenerator» names the ConfigMap «tugboat-config-<hash of its content>» and rewrites every reference to it. Change a value and the name changes, so the Deployment's pod template changes, so Kubernetes rolls out new pods with the new config.\n\nPreview with «kubectl kustomize DIR»; apply with «kubectl apply -k DIR». Helm (Port 11) is the other popular option; Port 11 compares them.",
      files: [
        {
          name: 'kustomize/base/kustomization.yaml',
          code: 'apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n- deployment.yaml\n- service.yaml\nconfigMapGenerator:\n- name: tugboat-config\n  literals:\n  - GREETING=Ahoy\n  - COLOR=#1f6feb',
          notes: [
            ['resources:', 'The plain manifests this base is made of.'],
            [
              'configMapGenerator:',
              'Generates a ConfigMap named tugboat-config-<hash> and rewrites references to it.',
            ],
          ],
        },
        {
          name: 'kustomize/base/deployment.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\n  labels:\n    app: tugboat\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        envFrom:\n        - configMapRef:\n            name: tugboat-config',
          notes: [],
          collapsed: true,
        },
        {
          name: 'kustomize/base/service.yaml',
          code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat\nspec:\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080',
          notes: [],
          collapsed: true,
        },
        {
          name: 'kustomize/overlays/dev/kustomization.yaml',
          code: 'apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nnamespace: dev\nresources:\n- ../../base\nconfigMapGenerator:\n- name: tugboat-config\n  behavior: merge\n  literals:\n  - GREETING=Hello from DEV\n  - COLOR=#7c3aed',
          notes: [
            ['namespace: dev', 'Every object from the base lands in the dev namespace.'],
            [
              'behavior: merge',
              "Override some keys of the base's generated ConfigMap and keep the rest.",
            ],
          ],
        },
        {
          name: 'kustomize/overlays/prod/kustomization.yaml',
          code: 'apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nnamespace: prod\nresources:\n- ../../base\nimages:\n- name: tugboat\n  newTag: v2\nreplicas:\n- name: tugboat\n  count: 3\nconfigMapGenerator:\n- name: tugboat-config\n  behavior: merge\n  literals:\n  - GREETING=Welcome aboard',
          notes: [
            ['images:', 'Swap the tag without touching the base YAML.'],
            ['replicas:', 'Prod runs three.'],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «kustomize/base/kustomization.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kustomize/base/kustomization.yaml',
        },
        {
          text: 'Create «kustomize/base/deployment.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kustomize/base/deployment.yaml',
        },
        {
          text: 'Create «kustomize/base/service.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kustomize/base/service.yaml',
        },
        {
          text: 'Create «kustomize/overlays/dev/kustomization.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kustomize/overlays/dev/kustomization.yaml',
        },
        {
          text: 'Create «kustomize/overlays/prod/kustomization.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kustomize/overlays/prod/kustomization.yaml',
        },
        {
          text: 'Preview prod before applying anything. Note the hashed ConfigMap name and the v2 tag.',
          code: "cd ~/kube-quest/module_04_config_secrets/kustomize\nkubectl kustomize overlays/prod | grep -E 'name: tugboat-config|image:|replicas:'",
          output:
            '  name: tugboat-config-7h5k9bt2m4\n  replicas: 3\n        image: tugboat:v2\n            name: tugboat-config-7h5k9bt2m4',
        },
        {
          text: 'Create both namespaces and apply both overlays.',
          code: 'kubectl create namespace dev\nkubectl create namespace prod\nkubectl apply -k overlays/dev\nkubectl apply -k overlays/prod\nkubectl get deploy -A -l app=tugboat',
          output:
            'NAMESPACE   NAME      READY   UP-TO-DATE   AVAILABLE\ndev         tugboat   1/1     1            1\nprod        tugboat   3/3     3            3',
        },
        {
          text: 'Same image family, different config.',
          code: "kubectl exec -n dev deploy/tugboat -- env | grep GREETING\nkubectl exec -n prod deploy/tugboat -- env | grep -E 'GREETING|APP_VERSION'",
          output: 'GREETING=Hello from DEV\nGREETING=Welcome aboard\nAPP_VERSION=v2',
        },
        {
          text: "Change dev's greeting in its overlay and re-apply.",
          code: "sed -i 's/Hello from DEV/Namaskaram from DEV/' overlays/dev/kustomization.yaml\nkubectl apply -k overlays/dev\nkubectl rollout status -n dev deployment/tugboat\nkubectl exec -n dev deploy/tugboat -- env | grep GREETING\nkubectl get configmap -n dev",
          output:
            'GREETING=Namaskaram from DEV\nNAME                         DATA   AGE\ntugboat-config-4c8m2fk7t9    2      10s\ntugboat-config-h7d2k9c5bf    2      3m',
          predict: {
            prompt:
              'You change GREETING in the dev overlay and run apply -k. Do you need a rollout restart this time?',
            options: [
              'No: the generated ConfigMap gets a new name, the pod template changes, and pods roll automatically',
              'Yes, env vars never update without a restart',
              'Yes, Kustomize only creates objects once',
              'No, because Kustomize patches the running containers',
            ],
            answers: [0],
            why: "The content hash in the ConfigMap's name is the whole trick. A new name is a template change, and template changes trigger rollouts.",
          },
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'Why does a ConfigMap generated by Kustomize have a hash suffix?',
          options: [
            'So a content change produces a new name, which changes the pod template and triggers a rollout',
            'To avoid name clashes between namespaces',
            'Kubernetes requires unique hashes on ConfigMaps',
            'To encrypt the data',
          ],
          answers: [0],
          why: "Changing the name changes every reference in the Deployment's pod template, and any template change makes the Deployment roll out new pods.",
        },
      ],
    },
  ],
  mission: {
    title: 'One image, two worlds',
    brief: "Run dev and prod from the same base, with prod's API key mounted as a file.",
    tasks: [
      'dev and prod both deployed with kubectl apply -k from one base',
      'prod runs 3 replicas of v2 with its own greeting and colour',
      'Add a secretGenerator to the prod overlay with API_KEY and mount it at /etc/tugboat/secret through a patch',
      "Show tugboat's /config in prod with the key masked",
      'Decode the generated Secret with kubectl and base64 -d',
      "Change dev's colour and confirm its pods rolled without a manual restart",
    ],
    hint: 'A strategic-merge patch in the overlay can add a volume and a volumeMount to the base Deployment. Reference the secret by its generator name; Kustomize adds the hash.',
    solution:
      "# overlays/prod/kustomization.yaml (additions)\nsecretGenerator:\n- name: tugboat-secret\n  literals:\n  - API_KEY=sk-prod-9b7e\npatches:\n- path: secret-mount.yaml\n\n# overlays/prod/secret-mount.yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  template:\n    spec:\n      containers:\n      - name: tugboat\n        volumeMounts:\n        - name: secret\n          mountPath: /etc/tugboat/secret\n          readOnly: true\n      volumes:\n      - name: secret\n        secret:\n          secretName: tugboat-secret\n\nkubectl apply -k overlays/prod\nkubectl port-forward -n prod deploy/tugboat 8081:8080 &\ncurl -s localhost:8081/config\nkubectl get secret -n prod -o name | grep tugboat-secret\nkubectl get secret -n prod <that-name> -o jsonpath='{.data.API_KEY}' | base64 -d",
  },
  cleanup:
    'kill %1 2>/dev/null\nkubectl delete namespace dev prod --ignore-not-found\nkubectl delete deployment tugboat --ignore-not-found\nkubectl delete configmap tugboat-config --ignore-not-found\nkubectl delete secret tugboat-secret --ignore-not-found',
};
