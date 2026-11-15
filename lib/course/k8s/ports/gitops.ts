/**
 * Port 10: GitOps. Git is the only door. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'gitops',
  number: 10,
  title: 'GitOps',
  tag: 'Git is the only door',
  hue: 4,
  dir: 'module_10_gitops',
  story:
    "Friday, 6 p.m. Production has 7 replicas, Git says 3, and nobody knows who ran kubectl scale. Someone's laptop holds the only copy of last week's fix. Today Git becomes the single way into the cluster, and an agent inside the cluster keeps the two in sync.",
  lessons: [
    {
      slug: 'why-gitops',
      title: 'Why GitOps',
      pain: 'kubectl apply from laptops means no review, no audit trail, and a cluster that silently drifts away from what anyone thinks is running.',
      fix: "So you use **GitOps**: Git holds the desired state, and an agent in the cluster pulls and reconciles it continuously. It's the Deployment control loop again, one level up.",
      body: 'The OpenGitOps principles: the desired state is **declarative**, **versioned and immutable** (Git history), **pulled automatically** by an agent, and **continuously reconciled**.\n\n|  | Push (CI runs kubectl) | Pull (GitOps agent) |\n|---|---|---|\n| Cluster credentials | Stored in CI, outside the cluster | Stay inside the cluster |\n| Drift | Unnoticed until the next deploy | Detected and optionally reverted within minutes |\n| Rollback | Re-run an old pipeline | «git revert» |\n| Audit | Pipeline logs | Git history and pull requests |\n\nThe usual flow splits two repos: CI builds and pushes the image from the app repo, then updates the image tag in a config repo; the GitOps agent (Argo CD or Flux) syncs the cluster from the config repo.',
      files: [
        {
          name: 'kq-gitops/tugboat/kustomization.yaml',
          code: 'apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n- deployment.yaml\n- service.yaml',
          notes: [],
        },
        {
          name: 'kq-gitops/tugboat/deployment.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        env:\n        - name: GREETING\n          value: "Deployed by Argo CD"\n        ports:\n        - containerPort: 8080',
          notes: [],
          collapsed: true,
        },
        {
          name: 'kq-gitops/tugboat/service.yaml',
          code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat\nspec:\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080',
          notes: [],
          collapsed: true,
        },
      ],
      lab: [
        {
          text: "Create a local Git repo with tugboat's manifests.",
          code: 'mkdir -p ~/kube-quest/module_10_gitops && cd ~/kube-quest/module_10_gitops',
        },
        {
          text: 'Create «kq-gitops/tugboat/kustomization.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kq-gitops/tugboat/kustomization.yaml',
        },
        {
          text: 'Create «kq-gitops/tugboat/deployment.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kq-gitops/tugboat/deployment.yaml',
        },
        {
          text: 'Create «kq-gitops/tugboat/service.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kq-gitops/tugboat/service.yaml',
        },
        {
          text: 'Commit it.',
          code: 'cd kq-gitops && git init -b main\ngit add . && git commit -m "tugboat: initial manifests"',
        },
        {
          text: 'Create an empty **public** repository named «kq-gitops» on GitHub (in the browser), then push. Replace YOUR_GITHUB_USER.',
          code: 'GH_USER=YOUR_GITHUB_USER\ngit remote add origin https://github.com/$GH_USER/kq-gitops.git\ngit push -u origin main',
        },
      ],
      checks: [
        {
          type: 'order',
          prompt: 'Order a typical GitOps release.',
          steps: [
            'A developer merges a code change',
            'CI builds the image and pushes it to a registry',
            'CI (or a bot) updates the image tag in the config repo',
            'The GitOps agent notices the new commit',
            'The agent syncs the cluster to match Git',
          ],
          why: "Only the agent inside the cluster ever changes the cluster. CI's last job is a Git commit, not a kubectl command.",
        },
      ],
    },
    {
      slug: 'argo-cd',
      title: 'Argo CD: Git to cluster',
      pain: "A repo of YAML doesn't deploy itself, and a human running kubectl apply from it just brings back the laptop problem.",
      fix: "So you install **Argo CD** and give it one **Application**: which repo, which path, which cluster and namespace. It does the rest, and can undo anyone's manual changes.",
      body: '- Argo CD polls Git (every 3 minutes by default, or instantly with a webhook), renders the manifests (plain YAML, Kustomize or Helm) and compares them with the cluster.\n- **Synced / OutOfSync** tells you whether the cluster matches Git; **Healthy / Degraded / Progressing** tells you whether the app works.\n- «automated» sync applies changes as they land in Git. «prune» deletes objects removed from Git. «selfHeal» reverts manual changes made in the cluster.\n- Flux is the other CNCF GitOps tool: no built-in UI, more composable controllers, the same principles.',
      files: [
        {
          name: 'application.yaml',
          code: 'apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: tugboat\n  namespace: argocd\nspec:\n  project: default\n  source:\n    repoURL: https://github.com/YOUR_GITHUB_USER/kq-gitops.git\n    targetRevision: main\n    path: tugboat\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: gitops-demo\n  syncPolicy:\n    automated:\n      prune: true\n      selfHeal: true\n    syncOptions:\n    - CreateNamespace=true',
          notes: [
            ['namespace: argocd', "Applications live in Argo CD's own namespace."],
            [
              'repoURL:',
              'Your public repo. Private repos need a deploy key or token registered in Argo CD.',
            ],
            ['path: tugboat', 'The folder holding the kustomization.yaml.'],
            [
              'server: https://kubernetes.default.svc',
              'Deploy into the same cluster Argo CD runs in.',
            ],
            ['prune: true', 'Delete objects that disappear from Git.'],
            ['selfHeal: true', 'Revert manual changes in the cluster back to what Git says.'],
            ['CreateNamespace=true', "Create gitops-demo if it doesn't exist."],
          ],
        },
      ],
      lab: [
        {
          text: 'Install Argo CD. Server-side apply is required because some of its CRDs are too big for client-side apply.',
          code: 'kubectl create namespace argocd\nkubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml\nkubectl wait --for=condition=Available deployment --all -n argocd --timeout=300s',
        },
        {
          text: "Get the initial admin password and open the UI (accept the browser's self-signed certificate warning).",
          code: 'kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo',
        },
        {
          text: 'Leave this running, then open **https://localhost:8443** in Windows and log in as admin.',
          code: 'kubectl port-forward svc/argocd-server -n argocd 8443:443',
          secondTerminal: true,
          browser: true,
        },
        {
          text: 'Create «application.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'application.yaml',
        },
        {
          text: 'Point it at your repo and apply it.',
          code: 'cd ~/kube-quest/module_10_gitops\nsed -i "s/YOUR_GITHUB_USER/$GH_USER/" application.yaml\nkubectl apply -f application.yaml\nkubectl get applications -n argocd -w',
          output:
            'NAME      SYNC STATUS   HEALTH STATUS\ntugboat   OutOfSync     Missing\ntugboat   Synced        Progressing\ntugboat   Synced        Healthy',
        },
        {
          text: 'Change Git, not the cluster: bump replicas to 4, commit and push. Click **Refresh** in the UI to skip the 3-minute poll.',
          code: 'cd ~/kube-quest/module_10_gitops/kq-gitops\nsed -i \'s/replicas: 2/replicas: 4/\' tugboat/deployment.yaml\ngit commit -am "scale tugboat to 4" && git push\nkubectl get pods -n gitops-demo -w',
        },
        {
          text: "Now act like the person who caused Friday's mystery.",
          code: 'kubectl scale deployment tugboat -n gitops-demo --replicas=9\nkubectl get deployment tugboat -n gitops-demo -w',
          output: 'tugboat   4/9   9   4   5m\ntugboat   4/4   4   4   5m',
          breakIt: true,
          predict: {
            prompt:
              'With selfHeal on, you run «kubectl scale --replicas=9» in gitops-demo. What happens?',
            options: [
              'Argo CD sees the drift and scales back to 4 within seconds',
              'The cluster keeps 9 until the next Git commit',
              'Argo CD updates Git to 9',
              'The Application is marked Degraded and stops syncing',
            ],
            answers: [0],
            why: 'selfHeal treats any difference from Git as drift to fix. Git is the only way to change the replica count now.',
          },
        },
        {
          text: 'Delete the Service from Git and watch prune remove it, then bring it back with a revert.',
          code: 'git rm tugboat/service.yaml && sed -i \'/service.yaml/d\' tugboat/kustomization.yaml\ngit commit -am "remove service" && git push\nsleep 20; kubectl get svc -n gitops-demo\ngit revert HEAD --no-edit && git push',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'In an Argo CD Application, what does «selfHeal: true» do?',
          options: [
            'Reverts changes made directly in the cluster so it matches Git again',
            'Restarts crashed pods',
            'Rolls back Git when a sync fails',
            'Retries failed image pulls',
          ],
          answers: [0],
          why: "selfHeal is about drift: any manual change to a managed object is overwritten with the state in Git. Pod restarts are still the kubelet's and controllers' job.",
        },
      ],
    },
    {
      slug: 'promotion-secrets',
      title: 'Environments, promotion and secrets',
      pain: "One folder works for a demo. A real company has dev, staging and prod, dozens of apps, and passwords that can't be committed to Git.",
      fix: 'So you structure the repo by environment, promote with pull requests, generate Applications with **ApplicationSets**, and keep secrets out of Git with **External Secrets**.',
      body: '- **Folders, not branches, per environment**: «apps/tugboat/overlays/dev», «…/prod». Promotion is a pull request that copies a tag from dev to prod.\n- **App of apps**: one Application that deploys other Applications. **ApplicationSet**: generate one Application per folder, per cluster or per pull request from a template.\n- **Image updates**: Renovate or Argo CD Image Updater open commits when a new image tag appears.\n- **Ordering**: sync waves and hooks run a database migration Job before the new Deployment.\n- **Secrets**: the External Secrets Operator reads Google Secret Manager (authenticating with Workload Identity from Port 09) and writes ordinary Kubernetes Secrets. Git only holds a pointer, never the value. Sealed Secrets is the alternative that commits encrypted values.',
      files: [
        {
          name: 'appset.yaml',
          code: "apiVersion: argoproj.io/v1alpha1\nkind: ApplicationSet\nmetadata:\n  name: tugboat-envs\n  namespace: argocd\nspec:\n  goTemplate: true\n  generators:\n  - git:\n      repoURL: https://github.com/YOUR_GITHUB_USER/kq-gitops.git\n      revision: main\n      directories:\n      - path: envs/*\n  template:\n    metadata:\n      name: 'tugboat-{{.path.basename}}'\n    spec:\n      project: default\n      source:\n        repoURL: https://github.com/YOUR_GITHUB_USER/kq-gitops.git\n        targetRevision: main\n        path: '{{.path.path}}'\n      destination:\n        server: https://kubernetes.default.svc\n        namespace: 'tugboat-{{.path.basename}}'\n      syncPolicy:\n        automated:\n          prune: true\n          selfHeal: true\n        syncOptions:\n        - CreateNamespace=true",
          notes: [
            ['kind: ApplicationSet', 'A factory for Applications.'],
            ['directories:', 'One Application per folder matching envs/*: envs/dev, envs/prod…'],
            [
              "'tugboat-{{.path.basename}}'",
              'Named after the folder, e.g. tugboat-dev and tugboat-prod.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «appset.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'appset.yaml',
        },
      ],
      checks: [
        {
          type: 'match',
          prompt: 'Match each GitOps need to the tool or pattern.',
          pairs: [
            [
              'A new environment folder should deploy automatically',
              'ApplicationSet with a git directory generator',
            ],
            [
              'Passwords must never be stored in Git',
              'External Secrets Operator with Secret Manager',
            ],
            ['Run a DB migration before the new version', 'Sync waves and hooks'],
            ['Promote v2 from dev to prod', "A pull request changing prod's tag"],
          ],
          why: "Each pattern keeps Git as the source of truth while handling something a single Application can't.",
        },
      ],
    },
  ],
  mission: {
    title: 'Git is the only door',
    brief: 'Run tugboat purely through Git.',
    tasks: [
      'Argo CD shows tugboat Synced and Healthy from your GitHub repo',
      'A Git commit changes the greeting and the pods roll',
      'A manual kubectl edit is reverted by selfHeal',
      'Commit invalid YAML, see the sync fail in the UI, and fix it with git revert',
      'Stretch: add envs/dev and envs/prod folders and deploy both with the ApplicationSet',
    ],
    solution:
      'sed -i \'s/Deployed by Argo CD/Hello from Git/\' tugboat/deployment.yaml\ngit commit -am "new greeting" && git push\nkubectl edit deployment tugboat -n gitops-demo    # change anything, watch it revert\necho "  bad: [yaml" >> tugboat/deployment.yaml && git commit -am "oops" && git push\n# Argo CD: ComparisonError / sync failed\ngit revert HEAD --no-edit && git push',
  },
  cleanup:
    'kubectl delete application tugboat -n argocd\nkubectl delete namespace gitops-demo --ignore-not-found\n# keep Argo CD installed if you want to try Helm through it in Port 11',
};
