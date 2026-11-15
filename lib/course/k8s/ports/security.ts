/**
 * Port 7: Security & RBAC. Least privilege. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'security',
  number: 7,
  title: 'Security & RBAC',
  tag: 'Least privilege',
  hue: 1,
  dir: 'module_07_security_rbac',
  story:
    'Monday again, and an audit report lands: "Why can the CI robot read every Secret and delete namespaces? And why does half the fleet run as root?" Today you give each identity only the permissions it needs, and make the cluster refuse containers that ask for too much.',
  lessons: [
    {
      slug: 'rbac',
      title: 'RBAC: who can do what, where',
      pain: 'Everyone shares one admin kubeconfig. The CI bot that only needs to update an image can also read every Secret and delete whole namespaces.',
      fix: 'So you use **RBAC**: Roles list allowed verbs on resources, RoleBindings grant them to users, groups or ServiceAccounts, and everything not granted is denied.',
      body: '**Authentication** answers "who are you?" (client certificates, OIDC tokens; on GKE your Google identity). **Authorization** answers "may you do this?", and RBAC is the standard authorizer. Users and groups aren\'t Kubernetes objects; **ServiceAccounts** are, and they\'re how workloads and robots get identities.\n\n| Object | Scope | Says |\n|---|---|---|\n| Role | One namespace | "get, list, patch on deployments" |\n| ClusterRole | Cluster-wide or reusable | Same, usable in any namespace (or for nodes, PVs…) |\n| RoleBinding | One namespace | Grants a Role or a ClusterRole to subjects, only in this namespace |\n| ClusterRoleBinding | Whole cluster | Grants a ClusterRole everywhere |\n\nA rule names «apiGroups» («""» for core objects like pods and secrets, «apps» for deployments, «batch» for jobs), «resources» (including subresources like «pods/log» and «pods/exec») and «verbs». Built-in ClusterRoles «view», «edit» and «admin» cover most needs when bound with a RoleBinding. Test everything with «kubectl auth can-i».',
      files: [
        {
          name: 'rbac.yaml',
          code: 'apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: ci-bot\n  namespace: team-a\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: deployer\n  namespace: team-a\nrules:\n- apiGroups: ["apps"]\n  resources: ["deployments"]\n  verbs: ["get", "list", "watch", "update", "patch"]\n- apiGroups: [""]\n  resources: ["pods", "pods/log"]\n  verbs: ["get", "list", "watch"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: ci-bot-deployer\n  namespace: team-a\nsubjects:\n- kind: ServiceAccount\n  name: ci-bot\n  namespace: team-a\nroleRef:\n  kind: Role\n  name: deployer\n  apiGroup: rbac.authorization.k8s.io',
          notes: [
            ['kind: ServiceAccount', 'An identity for a robot, scoped to a namespace.'],
            [
              'apiGroups: ["apps"]',
              'Deployments live in apps. Writing "" here is the most common RBAC bug.',
            ],
            [
              'verbs: ["get", "list", "watch", "update", "patch"]',
              'Enough to change an image; no create or delete.',
            ],
            [
              'pods/log',
              'Subresources need their own entry. Without it, kubectl logs is forbidden.',
            ],
            ['subjects:', 'Who gets the role. For a ServiceAccount you must give its namespace.'],
            [
              'roleRef:',
              "Which Role. It can't be changed after creation; delete and recreate the binding instead.",
            ],
          ],
        },
      ],
      sim: 'rbac',
      lab: [
        {
          text: 'Set up the folder, a namespace and an app for the bot to manage.',
          code: 'mkdir -p ~/kube-quest/module_07_security_rbac && cd ~/kube-quest/module_07_security_rbac\nkubectl create namespace team-a\nkubectl create deployment web --image=tugboat:v1 -n team-a',
        },
        {
          text: 'Who are you right now?',
          code: 'kubectl auth whoami',
          output:
            'ATTRIBUTE   VALUE\nUsername    kubernetes-admin\nGroups      [kubeadm:cluster-admins system:authenticated]',
        },
        {
          text: 'Create «rbac.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'rbac.yaml',
        },
        {
          text: 'Apply it and test permissions by impersonating the bot.',
          code: 'kubectl apply -f rbac.yaml\nBOT=system:serviceaccount:team-a:ci-bot\nkubectl auth can-i patch deployments -n team-a --as=$BOT\nkubectl auth can-i get secrets -n team-a --as=$BOT\nkubectl auth can-i patch deployments -n default --as=$BOT\nkubectl auth can-i delete deployments -n team-a --as=$BOT',
          output: 'yes\nno\nno\nno',
        },
        {
          text: 'Now log in as the bot for real: mint a 1-hour token and make a kubectl context for it.',
          code: 'TOKEN=$(kubectl create token ci-bot -n team-a --duration=1h)\nkubectl config set-credentials ci-bot --token=$TOKEN\nkubectl config set-context ci-bot@kq --cluster=kind-kq --user=ci-bot --namespace=team-a\nkubectl --context ci-bot@kq auth whoami',
          output: 'Username    system:serviceaccount:team-a:ci-bot',
        },
        {
          text: "Do the bot's job, then try to overstep.",
          code: 'kubectl --context ci-bot@kq set image deployment/web tugboat=tugboat:v2\nkubectl --context ci-bot@kq get pods\nkubectl --context ci-bot@kq get secrets',
          output:
            'deployment.apps/web image updated\nNAME                   READY   STATUS    RESTARTS   AGE\nweb-6b8d7f9c5-k2x8q    1/1     Running   0          5s\nError from server (Forbidden): secrets is forbidden: User "system:serviceaccount:team-a:ci-bot" cannot list resource "secrets" in API group "" in the namespace "team-a"',
          predict: {
            prompt: 'As ci-bot you run «kubectl get secrets» in team-a. What do you get?',
            options: [
              'Forbidden, naming the user, verb, resource and namespace',
              'An empty list',
              'The secrets, base64 encoded',
              'A login prompt',
            ],
            answers: [0],
            why: 'RBAC denies by default and says exactly what was missing, which makes the error the best debugging tool you have.',
          },
        },
        {
          text: 'List everything the bot may do in its namespace.',
          code: 'kubectl auth can-i --list -n team-a --as=system:serviceaccount:team-a:ci-bot | head -8',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'A RoleBinding in namespace team-a references the built-in ClusterRole «view». What does the subject get?',
          options: [
            'Read access to most objects, only in team-a',
            'Read access in every namespace',
            'Full admin rights in team-a',
            "Nothing: a RoleBinding can't reference a ClusterRole",
          ],
          answers: [0],
          why: "Binding a ClusterRole with a RoleBinding reuses its rules but limits them to the binding's namespace. It's the standard way to hand out view or edit per namespace.",
        },
      ],
    },
    {
      slug: 'pod-security',
      title: "Pod security: don't run as root",
      pain: 'Most images run as root with every default Linux capability. One remote-code bug and an attacker owns the container, and a privileged one owns the node.',
      fix: "So you harden pods with a **securityContext**, and let **Pod Security Admission** reject anything that doesn't meet the bar.",
      body: '| Setting | Effect |\n|---|---|\n| «runAsNonRoot: true» | Refuse to start if the image would run as UID 0 |\n| «allowPrivilegeEscalation: false» | No setuid tricks to gain privileges |\n| «capabilities: drop: ["ALL"]» | Remove Linux capabilities the app doesn\'t need |\n| «seccompProfile: RuntimeDefault» | Block dangerous system calls |\n| «readOnlyRootFilesystem: true» | The app can only write to mounted volumes |\n\n**Pod Security Admission** is built in. Label a namespace with a level («privileged», «baseline» or «restricted») and a mode («enforce» rejects, «warn» and «audit» only report). «restricted» requires the first four settings above; a read-only root filesystem is optional but good practice.\n\nSupply-chain hygiene completes the picture: small or distroless base images, vulnerability scanning (Artifact Analysis on Google Cloud), and signature checks before deploy (Binary Authorization on GKE). GKE Autopilot already blocks privileged pods.',
      files: [
        {
          name: 'hardened.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\n  namespace: team-a\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      securityContext:\n        runAsNonRoot: true\n        runAsUser: 10001\n        seccompProfile:\n          type: RuntimeDefault\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080\n        securityContext:\n          allowPrivilegeEscalation: false\n          readOnlyRootFilesystem: true\n          capabilities:\n            drop: ["ALL"]\n        volumeMounts:\n        - name: data\n          mountPath: /data\n        - name: tmp\n          mountPath: /tmp\n      volumes:\n      - name: data\n        emptyDir: {}\n      - name: tmp\n        emptyDir: {}',
          notes: [
            ['securityContext:', 'Pod-level settings apply to every container in the pod.'],
            ['runAsUser: 10001', "Matches the USER in tugboat's Dockerfile."],
            ['type: RuntimeDefault', "The container runtime's default seccomp filter."],
            ['allowPrivilegeEscalation: false', 'Required by the restricted level.'],
            [
              'readOnlyRootFilesystem: true',
              "Even with code execution, an attacker can't modify the app's files.",
            ],
            ['drop: ["ALL"]', 'tugboat needs no special capabilities at all.'],
            ['mountPath: /tmp', 'Writable scratch space, since the root filesystem is read-only.'],
          ],
        },
      ],
      lab: [
        {
          text: 'Enforce the restricted level on team-a. The warning tells you which running pods would fail.',
          code: 'cd ~/kube-quest/module_07_security_rbac\nkubectl label namespace team-a pod-security.kubernetes.io/enforce=restricted pod-security.kubernetes.io/warn=restricted',
          output:
            'Warning: existing pods in namespace "team-a" violate the new PodSecurity enforce level "restricted:latest"\nWarning: web-6b8d7f9c5-k2x8q: allowPrivilegeEscalation != false, unrestricted capabilities, runAsNonRoot != true, seccompProfile\nnamespace/team-a labeled',
        },
        {
          text: 'Try a typical root container.',
          code: 'kubectl run rooty --image=nginx:1.27 -n team-a',
          output:
            'Error from server (Forbidden): pods "rooty" is forbidden: violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false (container "rooty" must set securityContext.allowPrivilegeEscalation=false), unrestricted capabilities (…), runAsNonRoot != true (…), seccompProfile (…)',
          predict: {
            prompt:
              'You start nginx (which runs as root with default settings) in team-a. What happens?',
            options: [
              'The API server rejects the pod and lists every violation',
              'It starts, and a warning is logged',
              "It starts but can't bind port 80",
              'The existing web pods are evicted',
            ],
            answers: [0],
            why: "enforce mode blocks new pods that fail the level. Pods already running aren't touched; they only fail when they're next recreated.",
          },
        },
        {
          text: 'Create «hardened.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'hardened.yaml',
        },
        {
          text: 'Apply the hardened version of web (a warning about a missing last-applied annotation is expected, because web was created with kubectl create).',
          code: 'kubectl apply -f hardened.yaml && kubectl rollout status -n team-a deployment/web',
        },
        {
          text: 'Prove it from inside.',
          code: 'kubectl exec -n team-a deploy/web -- id\nkubectl exec -n team-a deploy/web -- touch /app/hacked',
          output:
            "uid=10001(tugboat) gid=10001(tugboat) groups=10001(tugboat)\ntouch: cannot touch '/app/hacked': Read-only file system\ncommand terminated with exit code 1",
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'Which of these is **not** required by the restricted Pod Security level?',
          options: [
            'readOnlyRootFilesystem: true',
            'runAsNonRoot: true',
            'allowPrivilegeEscalation: false',
            'Dropping ALL capabilities',
          ],
          answers: [0],
          why: 'restricted requires non-root, no privilege escalation, dropped capabilities and a seccomp profile. A read-only root filesystem is recommended hardening, not part of the standard.',
        },
      ],
    },
  ],
  mission: {
    title: 'Lock down team-a',
    brief: 'Leave team-a with the fewest permissions that still let everyone work.',
    tasks: [
      'team-a enforces the restricted Pod Security level',
      'ci-bot can update deployments and read pods and logs, and nothing else',
      'A new ServiceAccount auditor gets read-only access to team-a through the built-in view ClusterRole',
      "kubectl auth can-i shows auditor can list pods in team-a but not in default, and can't read secrets",
      'The hardened web Deployment runs with a read-only root filesystem',
    ],
    solution:
      'kubectl create serviceaccount auditor -n team-a\nkubectl create rolebinding auditor-view -n team-a --clusterrole=view --serviceaccount=team-a:auditor\nA=system:serviceaccount:team-a:auditor\nkubectl auth can-i list pods -n team-a --as=$A      # yes\nkubectl auth can-i list pods -n default --as=$A     # no\nkubectl auth can-i get secrets -n team-a --as=$A    # no (view excludes secrets)',
  },
  cleanup:
    'kubectl config delete-context ci-bot@kq\nkubectl config delete-user ci-bot\nkubectl delete namespace team-a',
};
