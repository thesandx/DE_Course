/**
 * Port 11: Helm. Package the fleet. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'helm',
  number: 11,
  title: 'Helm',
  tag: 'Package the fleet',
  hue: 5,
  dir: 'module_11_helm',
  story:
    'Three teams have copied your tugboat YAML and each one edits it differently. Installing Argo CD meant applying hundreds of objects from one URL, and upgrading it will mean diffing them by hand. Today you package software the way the ecosystem does.',
  lessons: [
    {
      slug: 'helm-basics',
      title: 'Helm: charts, values and releases',
      pain: 'Installing third-party software means dozens of manifests, and upgrading it means working out what changed by hand.',
      fix: 'So you use **Helm**: a **chart** is a versioned package of templated manifests, and each install is a **release** with a revision history you can upgrade and roll back.',
      body: "| Term | Meaning |\n|---|---|\n| Chart | A folder (or .tgz) with Chart.yaml, values.yaml and templates/ |\n| Values | Settings you override with «--set» or «-f my-values.yaml» |\n| Release | One installed instance of a chart, with a name, in a namespace |\n| Revision | Each install, upgrade or rollback adds one. Stored as Secrets in the release's namespace |\n\nCharts are shared through classic repositories (an index.yaml on a web server) or **OCI registries** such as GitHub Container Registry or Artifact Registry. Helm 4, released in November 2025, is the current major version; its install script is «get-helm-4».\n\nAlways read a chart's values before installing: «helm show values».",
      files: [],
      lab: [
        {
          text: 'Install Helm 4.',
          code: 'curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4\nchmod 700 get_helm.sh && ./get_helm.sh\nhelm version',
          output: 'version.BuildInfo{Version:"v4.x.x", …}',
        },
        {
          text: "Inspect a public chart's settings before installing it.",
          code: 'mkdir -p ~/kube-quest/module_11_helm && cd ~/kube-quest/module_11_helm\nhelm show values oci://ghcr.io/stefanprodan/charts/podinfo | head -30',
        },
        {
          text: 'Install it as a release named podinfo, overriding two values.',
          code: 'helm install podinfo oci://ghcr.io/stefanprodan/charts/podinfo --set replicaCount=2 --set ui.message="Ahoy from Helm"\nhelm list\nkubectl get pods | grep podinfo',
        },
        {
          text: 'Open it in Windows at http://localhost:9898.',
          code: 'kubectl port-forward svc/podinfo 9898:9898',
          secondTerminal: true,
          browser: true,
        },
        {
          text: 'Upgrade one value and keep the others.',
          code: 'helm upgrade podinfo oci://ghcr.io/stefanprodan/charts/podinfo --reuse-values --set ui.color="#c2410c"\nhelm history podinfo',
          output:
            'REVISION  STATUS      DESCRIPTION\n1         superseded  Install complete\n2         deployed    Upgrade complete',
        },
        {
          text: 'Roll back to revision 1.',
          code: 'helm rollback podinfo 1\nhelm history podinfo\nkubectl get secrets | grep sh.helm.release',
          output:
            '3         deployed    Rollback to 1\nsh.helm.release.v1.podinfo.v1   helm.sh/release.v1   1   3m\nsh.helm.release.v1.podinfo.v2   helm.sh/release.v1   1   2m\nsh.helm.release.v1.podinfo.v3   helm.sh/release.v1   1   5s',
          predict: {
            prompt:
              'After helm rollback podinfo 1, what does helm history show as the newest revision?',
            options: [
              'Revision 3, which is a copy of revision 1',
              'Revision 1 again',
              'Revision 2, marked rolled back',
              'Nothing; rollback deletes history',
            ],
            answers: [0],
            why: 'Helm never rewrites history: a rollback is a new revision with the old content, so you can always see what happened and roll forward again.',
          },
        },
        {
          text: 'Remove it.',
          code: 'helm uninstall podinfo',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: "You run «helm rollback myapp 1» on a release at revision 4. What's the result?",
          options: [
            "A new revision 5 with revision 1's content",
            'The release returns to revision 1 and revisions 2 to 4 are deleted',
            'Revision 4 is marked as failed',
            'Helm reinstalls the chart from scratch',
          ],
          answers: [0],
          why: 'Rollbacks append to history. That keeps an audit trail and lets you undo the rollback too.',
        },
      ],
    },
    {
      slug: 'own-chart',
      title: 'Write your own chart',
      pain: "Three teams each keep a slightly different copy of tugboat's YAML, and a fix in one never reaches the others.",
      fix: 'So you write one chart: sensible defaults in «values.yaml», templates that read them, and each team overrides only what differs.',
      body: "Templates are Go templates. The ones you'll use most:\n\n| Syntax | Does |\n|---|---|\n| «{{ .Values.replicaCount }}» | Insert a value |\n| «{{ .Release.Name }}» | The release name, so two installs don't collide |\n| «{{ .Values.greeting | quote }}» | Pipe through a function (wrap in quotes) |\n| «{{- if .Values.autoscaling.enabled }} … {{- end }}» | Optional blocks; «-» trims whitespace |\n| «{{- toYaml .Values.resources | nindent 10 }}» | Paste a whole YAML block at the right indentation |\n\nCheck your work without touching the cluster: «helm lint» catches structural errors and «helm template» prints the rendered YAML.",
      files: [
        {
          name: 'tugboat-chart/Chart.yaml',
          code: 'apiVersion: v2\nname: tugboat\ndescription: The tugboat practice app\ntype: application\nversion: 0.1.0\nappVersion: "v1"',
          notes: [
            ['apiVersion: v2', 'The chart format for Helm 3 and 4.'],
            ['version: 0.1.0', "The chart's own version. Bump it whenever the chart changes."],
            ['appVersion:', 'The version of the app inside. Informational.'],
          ],
        },
        {
          name: 'tugboat-chart/values.yaml',
          code: 'replicaCount: 2\nimage:\n  repository: tugboat\n  tag: v1\ngreeting: Ahoy\ncolor: "#1f6feb"\nservice:\n  type: ClusterIP\n  port: 80\nresources:\n  requests:\n    cpu: 100m\n    memory: 64Mi\n  limits:\n    memory: 128Mi\nautoscaling:\n  enabled: false\n  minReplicas: 2\n  maxReplicas: 6\n  targetCPU: 60',
          notes: [
            ['replicaCount: 2', 'Ignored when autoscaling is enabled, so the HPA owns replicas.'],
            ['color: "#1f6feb"', 'Quoted, because an unquoted # starts a YAML comment.'],
            ['autoscaling:', 'Off by default. The prod values turn it on.'],
          ],
        },
        {
          name: 'tugboat-chart/templates/deployment.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: {{ .Release.Name }}\n  labels:\n    app.kubernetes.io/name: tugboat\n    app.kubernetes.io/instance: {{ .Release.Name }}\nspec:\n  {{- if not .Values.autoscaling.enabled }}\n  replicas: {{ .Values.replicaCount }}\n  {{- end }}\n  selector:\n    matchLabels:\n      app.kubernetes.io/instance: {{ .Release.Name }}\n  template:\n    metadata:\n      labels:\n        app.kubernetes.io/name: tugboat\n        app.kubernetes.io/instance: {{ .Release.Name }}\n    spec:\n      containers:\n      - name: tugboat\n        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"\n        ports:\n        - containerPort: 8080\n        env:\n        - name: GREETING\n          value: {{ .Values.greeting | quote }}\n        - name: COLOR\n          value: {{ .Values.color | quote }}\n        readinessProbe:\n          httpGet:\n            path: /readyz\n            port: 8080\n        resources:\n          {{- toYaml .Values.resources | nindent 10 }}',
          notes: [
            ['name: {{ .Release.Name }}', 'Each release gets its own Deployment name: dev, prod…'],
            [
              '{{- if not .Values.autoscaling.enabled }}',
              'Leave replicas out when an HPA manages them, or every upgrade would reset the count.',
            ],
            [
              'app.kubernetes.io/instance:',
              'The recommended label set; the instance label keeps releases apart.',
            ],
            ['| quote', 'Wraps the value in quotes so YAML treats it as a string.'],
            ['nindent 10', 'Newline plus 10 spaces: the indentation under resources:.'],
          ],
        },
        {
          name: 'tugboat-chart/templates/service.yaml',
          code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: {{ .Release.Name }}\nspec:\n  type: {{ .Values.service.type }}\n  selector:\n    app.kubernetes.io/instance: {{ .Release.Name }}\n  ports:\n  - port: {{ .Values.service.port }}\n    targetPort: 8080',
          notes: [],
          collapsed: true,
        },
        {
          name: 'tugboat-chart/templates/hpa.yaml',
          code: '{{- if .Values.autoscaling.enabled }}\napiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: {{ .Release.Name }}\nspec:\n  scaleTargetRef:\n    apiVersion: apps/v1\n    kind: Deployment\n    name: {{ .Release.Name }}\n  minReplicas: {{ .Values.autoscaling.minReplicas }}\n  maxReplicas: {{ .Values.autoscaling.maxReplicas }}\n  metrics:\n  - type: Resource\n    resource:\n      name: cpu\n      target:\n        type: Utilization\n        averageUtilization: {{ .Values.autoscaling.targetCPU }}\n{{- end }}',
          notes: [
            [
              '{{- if .Values.autoscaling.enabled }}',
              'The whole file renders to nothing unless autoscaling is on.',
            ],
          ],
        },
        {
          name: 'values-prod.yaml',
          code: 'image:\n  tag: v2\ngreeting: "Welcome aboard (prod)"\nautoscaling:\n  enabled: true\n  maxReplicas: 8',
          notes: [
            [
              'tag: v2',
              'Only the differences from values.yaml. Helm merges them over the defaults.',
            ],
            ['enabled: true', "Prod gets an HPA; dev doesn't."],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «tugboat-chart/Chart.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'tugboat-chart/Chart.yaml',
        },
        {
          text: 'Create «tugboat-chart/values.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'tugboat-chart/values.yaml',
        },
        {
          text: 'Create «tugboat-chart/templates/deployment.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'tugboat-chart/templates/deployment.yaml',
        },
        {
          text: 'Create «tugboat-chart/templates/service.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'tugboat-chart/templates/service.yaml',
        },
        {
          text: 'Create «tugboat-chart/templates/hpa.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'tugboat-chart/templates/hpa.yaml',
        },
        {
          text: 'Create «values-prod.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'values-prod.yaml',
        },
        {
          text: 'Lint and render before installing anything.',
          code: "cd ~/kube-quest/module_11_helm\nhelm lint ./tugboat-chart\nhelm template dev ./tugboat-chart | head -30\nhelm template prod ./tugboat-chart -f values-prod.yaml | grep -E 'kind:|image:|replicas:'",
          output:
            '==> Linting ./tugboat-chart\n1 chart(s) linted, 0 chart(s) failed\nkind: Service\nkind: Deployment\n        image: "tugboat:v2"\nkind: HorizontalPodAutoscaler',
        },
        {
          text: 'Install two releases from the same chart.',
          code: 'helm install dev ./tugboat-chart\nhelm install prod ./tugboat-chart -f values-prod.yaml -n prod --create-namespace\nhelm list -A\nkubectl get deploy,hpa -A -l app.kubernetes.io/name=tugboat',
        },
        {
          text: 'Upgrade dev with a one-off value, then roll back.',
          code: 'helm upgrade dev ./tugboat-chart --set greeting="Hello again"\nkubectl exec deploy/dev -- env | grep GREETING\nhelm rollback dev 1\nhelm history dev',
        },
        {
          text: 'Break the template: change «nindent 10» to «nindent 4» and render.',
          code: "sed -i 's/nindent 10/nindent 4/' tugboat-chart/templates/deployment.yaml\nhelm template dev ./tugboat-chart > /dev/null\nsed -i 's/nindent 4/nindent 10/' tugboat-chart/templates/deployment.yaml",
          output:
            'Error: YAML parse error on tugboat/templates/deployment.yaml: error converting YAML to JSON: yaml: line 33: did not find expected key',
          breakIt: true,
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'values.yaml has «greeting: Ahoy» and the template says «value: {{ .Values.greeting | quote }}». What renders?',
          options: [
            'value: "Ahoy"',
            'value: Ahoy',
            'value: {{ Ahoy }}',
            'value: "{{ .Values.greeting }}"',
          ],
          answers: [0],
          why: 'The value goes through the quote function, which wraps it in double quotes. That protects values like yes, 0123 or #fff from being read as another YAML type.',
        },
      ],
    },
    {
      slug: 'helm-or-kustomize',
      title: 'Helm or Kustomize, and Helm in GitOps',
      pain: 'You now know two ways to stop copy-pasting YAML. Teams argue about which one to use.',
      fix: 'So you use each where it fits: **Helm** to package and share software with knobs, **Kustomize** to patch your own manifests per environment. Argo CD speaks both.',
      body: "|  | Helm | Kustomize |\n|---|---|---|\n| Approach | Templates plus values | Plain YAML plus patches |\n| Best for | Distributing software to others; many configurable options | Your own apps across a few environments |\n| Release history and rollback | Built in | Use Git (and Argo CD) |\n| Packaging | Versioned charts in OCI registries | Folders in Git |\n| Learning curve | Go templates | Just YAML |\n\nMany teams combine them: install third-party software from charts, keep their own apps in Kustomize, and let Argo CD render both. When Argo CD deploys a chart, it runs «helm template» itself and manages the objects, so «helm list» won't show those releases.\n\nPractical habits: pin chart versions, prefer «helm upgrade --install» in automation (it works whether or not the release exists), and remember that Helm installs CRDs from a chart's «crds/» folder once but never upgrades them.",
      files: [
        {
          name: 'app-helm.yaml',
          code: 'apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: tugboat-helm\n  namespace: argocd\nspec:\n  project: default\n  source:\n    repoURL: https://github.com/YOUR_GITHUB_USER/kq-gitops.git\n    targetRevision: main\n    path: charts/tugboat\n    helm:\n      valueFiles:\n      - values-prod.yaml\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: helm-prod\n  syncPolicy:\n    automated:\n      prune: true\n      selfHeal: true\n    syncOptions:\n    - CreateNamespace=true',
          notes: [
            [
              'path: charts/tugboat',
              'Copy your chart into the kq-gitops repo under charts/tugboat.',
            ],
            [
              'valueFiles:',
              'Paths relative to the chart folder, so put values-prod.yaml inside charts/tugboat.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Optional, if Argo CD from Port 10 is still installed: ship the chart through Git.',
          code: 'cd ~/kube-quest/module_10_gitops/kq-gitops\nmkdir -p charts && cp -r ~/kube-quest/module_11_helm/tugboat-chart charts/tugboat\ncp ~/kube-quest/module_11_helm/values-prod.yaml charts/tugboat/\ngit add charts && git commit -m "add tugboat chart" && git push',
        },
        {
          text: 'Create «app-helm.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'app-helm.yaml',
        },
        {
          text: 'Put your GitHub user into the Application, apply it, and check what Argo CD made from the chart.',
          code: 'cd ~/kube-quest/module_11_helm\nsed -i "s/YOUR_GITHUB_USER/$GH_USER/" app-helm.yaml\nkubectl apply -f app-helm.yaml\nkubectl get applications -n argocd\nkubectl get deploy,hpa -n helm-prod',
        },
      ],
      checks: [
        {
          type: 'match',
          prompt: 'Match each situation to the better fit.',
          pairs: [
            ['Publish an installable package with 40 options for other teams', 'Helm chart'],
            ['Same internal app in dev and prod with small differences', 'Kustomize overlays'],
            ['Roll back the last install with one command', 'helm rollback'],
            ["Patch one field of a third-party manifest you don't control", 'Kustomize patch'],
          ],
          why: 'Helm shines at packaging and releasing; Kustomize at lightweight, template-free customisation of YAML you own.',
        },
      ],
    },
  ],
  mission: {
    title: 'Package the fleet',
    brief: 'Turn tugboat into a chart other teams can install safely.',
    tasks: [
      'Your chart passes helm lint and renders with and without values-prod.yaml',
      'Add a templates/pdb.yaml that renders only when pdb.enabled is true',
      'Install dev and prod releases; prod runs v2 with an HPA',
      "Upgrade prod's greeting, then roll it back, and read helm history",
      'Stretch: deploy the chart through Argo CD from your Git repo',
    ],
    solution:
      '# values.yaml\npdb:\n  enabled: false\n  minAvailable: 1\n\n# templates/pdb.yaml\n{{- if .Values.pdb.enabled }}\napiVersion: policy/v1\nkind: PodDisruptionBudget\nmetadata:\n  name: {{ .Release.Name }}\nspec:\n  minAvailable: {{ .Values.pdb.minAvailable }}\n  selector:\n    matchLabels:\n      app.kubernetes.io/instance: {{ .Release.Name }}\n{{- end }}\n\nhelm template prod ./tugboat-chart -f values-prod.yaml --set pdb.enabled=true | grep -A3 PodDisruptionBudget\nhelm upgrade prod ./tugboat-chart -n prod -f values-prod.yaml --set pdb.enabled=true --set greeting="Ahoy prod"\nhelm rollback prod 1 -n prod && helm history prod -n prod',
  },
  cleanup:
    'helm uninstall dev\nhelm uninstall prod -n prod\nkubectl delete namespace prod --ignore-not-found\nkubectl delete application tugboat-helm -n argocd --ignore-not-found\nkubectl delete namespace helm-prod --ignore-not-found',
};
