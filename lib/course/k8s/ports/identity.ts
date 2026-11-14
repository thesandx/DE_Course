/**
 * Port 9: Workload Identity. Credentials without keys. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'identity',
  number: 9,
  title: 'Workload Identity',
  tag: 'Credentials without keys',
  hue: 3,
  dir: 'module_09_workload_identity',
  story:
    'The data team wants tugboat to read a Cloud Storage bucket. Someone suggests the quick way: "Just put a service account JSON key in a Secret." You\'ve seen how that ends. Today you learn how pods prove who they are, to the Kubernetes API and to Google Cloud, without long-lived keys.',
  lessons: [
    {
      slug: 'serviceaccount-tokens',
      title: 'ServiceAccount tokens: every pod has an ID card',
      pain: 'Pods need identities too: to call the Kubernetes API, or to call a cloud API. Long-lived passwords stored in Secrets leak and never expire.',
      fix: 'So every pod runs as a **ServiceAccount** and gets a short-lived, audience-bound token mounted automatically, which the API server (and clouds) can verify.',
      body: "- Each namespace has a «default» ServiceAccount; set «serviceAccountName» to use another.\n- The kubelet mounts a **projected token** at «/var/run/secrets/kubernetes.io/serviceaccount/token» and refreshes it before it expires. The token is a JWT bound to this pod: delete the pod and the token stops working.\n- Tokens carry an **audience** («aud»): the system they're meant for. A token minted for one audience is rejected by another.\n- The API server publishes its token issuer and signing keys (OIDC discovery). That's what lets outside systems such as Google Cloud, AWS or Vault trust Kubernetes tokens: the basis of workload identity federation.\n- Set «automountServiceAccountToken: false» for pods that never call the API.",
      files: [
        {
          name: 'crew.yaml',
          code: 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: crew\n---\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: navigator\n  namespace: crew\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\n  namespace: crew\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      serviceAccountName: navigator\n      containers:\n      - name: tugboat\n        image: tugboat:v1',
          notes: [
            ['kind: ServiceAccount', "The identity tugboat's pods will run as."],
            [
              'serviceAccountName: navigator',
              "Without this line the pods would run as crew's default ServiceAccount.",
            ],
          ],
        },
        {
          name: 'pod-reader.yaml',
          code: 'apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: pod-reader\n  namespace: crew\nrules:\n- apiGroups: [""]\n  resources: ["pods"]\n  verbs: ["get", "list"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: navigator-reads-pods\n  namespace: crew\nsubjects:\n- kind: ServiceAccount\n  name: navigator\n  namespace: crew\nroleRef:\n  kind: Role\n  name: pod-reader\n  apiGroup: rbac.authorization.k8s.io',
          notes: [
            [
              'verbs: ["get", "list"]',
              "Just enough for tugboat's /peers endpoint to list pods in its own namespace.",
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Set up the folder and a helper that calls tugboat from inside one of its own pods.',
          code: 'mkdir -p ~/kube-quest/module_09_workload_identity && cd ~/kube-quest/module_09_workload_identity\nask(){ kubectl exec -n crew deploy/tugboat -- python -c "import urllib.request,urllib.error,sys\ntry: print(urllib.request.urlopen(\'http://localhost:8080\'+sys.argv[1]).read().decode())\nexcept urllib.error.HTTPError as e: print(e.code, e.read().decode())" "$1"; }',
        },
        {
          text: 'Create «crew.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'crew.yaml',
        },
        {
          text: 'Apply it and look at the mounted identity files.',
          code: 'kubectl apply -f crew.yaml && kubectl rollout status -n crew deployment/tugboat\nkubectl exec -n crew deploy/tugboat -- ls /var/run/secrets/kubernetes.io/serviceaccount',
          output: 'ca.crt\nnamespace\ntoken',
        },
        {
          text: "tugboat's /whoami decodes its own token.",
          code: 'ask /whoami',
          output:
            '{\n  "aud": ["https://kubernetes.default.svc.cluster.local"],\n  "iss": "https://kubernetes.default.svc.cluster.local",\n  "sub": "system:serviceaccount:crew:navigator",\n  "kubernetes.io": {"namespace": "crew", "pod": {"name": "tugboat-6d7…", "uid": "…"}, "serviceaccount": {"name": "navigator", "uid": "…"}, "warnafter": …},\n  "exp": …,\n  "expires_in_minutes": …\n}',
        },
        {
          text: "tugboat's /peers uses that token to list pods through the Kubernetes API.",
          code: 'ask /peers',
          output:
            '403 Kubernetes API said 403: {"kind":"Status",…"message":"pods is forbidden: User \\"system:serviceaccount:crew:navigator\\" cannot list resource \\"pods\\" in API group \\"\\" in the namespace \\"crew\\""…',
          predict: {
            prompt: 'navigator has no Role yet. What does /peers return?',
            options: [
              '403 Forbidden from the API server, naming navigator',
              'An empty list',
              '401 Unauthorized, because the token is invalid',
              'The pods, since every ServiceAccount can list its own namespace',
            ],
            answers: [0],
            why: 'The token is valid, so authentication succeeds (no 401). Authorization then fails, because nothing grants navigator list on pods.',
          },
        },
        {
          text: 'Create «pod-reader.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'pod-reader.yaml',
        },
        {
          text: 'Grant the narrow permission and try again.',
          code: 'kubectl apply -f pod-reader.yaml\nask /peers',
          output: 'tugboat-6d7c8b9f5-2kq8x  Running\ntugboat-6d7c8b9f5-v9m4t  Running',
        },
        {
          text: 'Mint your own short-lived token for a different audience and read its claims.',
          code: "kubectl create token navigator -n crew --audience=billing.example.com --duration=10m | python3 -c \"import sys,json,base64; p=sys.stdin.read().split('.')[1]; p+='='*(-len(p)%4); print(json.dumps(json.loads(base64.urlsafe_b64decode(p)), indent=2))\"",
          output:
            '{\n  "aud": ["billing.example.com"],\n  "exp": …,\n  "sub": "system:serviceaccount:crew:navigator",\n  …\n}',
        },
        {
          text: 'See the OIDC discovery document that outside systems use to verify these tokens.',
          code: 'kubectl get --raw /.well-known/openid-configuration',
          output:
            '{"issuer":"https://kubernetes.default.svc.cluster.local","jwks_uri":"https://…/openid/v1/jwks",…}',
        },
        {
          text: "Turn the token off for pods that don't need it.",
          code: 'kubectl patch deployment tugboat -n crew -p \'{"spec":{"template":{"spec":{"automountServiceAccountToken":false}}}}\'\nkubectl rollout status -n crew deployment/tugboat\nask /whoami',
          output: '404 no ServiceAccount token mounted (automountServiceAccountToken: false?)',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'Why does a ServiceAccount token carry an audience?',
          options: [
            'So the token is only accepted by the system it was minted for',
            'To record which node issued it',
            'To encrypt the token',
            'To list the pods allowed to use it',
          ],
          answers: [0],
          why: "An audience stops replay: a token stolen from a call to service A can't be used against service B, because B checks that it's the intended audience.",
        },
      ],
    },
    {
      slug: 'workload-identity',
      title: 'Cloud access without keys',
      pain: 'The quick fix is a Google service account JSON key stored in a Secret. It never expires, gets copied to laptops and CI logs, and one leak hands an attacker your data.',
      fix: 'So you use **Workload Identity Federation for GKE**: grant IAM roles directly to the Kubernetes ServiceAccount, and pods get short-lived Google tokens from the GKE metadata server. No keys anywhere.',
      body: "**Pod (KSA token)** → asks → **GKE metadata server** → exchanges via STS → **Short-lived Google token** → calls → **Cloud Storage, BigQuery…**\n\nEvery GKE cluster with workload identity enabled belongs to the pool «PROJECT_ID.svc.id.goog». IAM can name a Kubernetes ServiceAccount directly as a principal:\n\n~~~text\nprincipal://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/PROJECT_ID.svc.id.goog/subject/ns/NAMESPACE/sa/KSA_NAME\n~~~\n\n- Autopilot clusters have it on by default. Standard clusters need «--workload-pool=PROJECT_ID.svc.id.goog» and the GKE metadata server on their node pools.\n- «principalSet://…/namespace/NAMESPACE» grants a role to every ServiceAccount in a namespace.\n- The older pattern still works and is needed by some products: link the KSA to a Google service account with the annotation «iam.gke.io/gcp-service-account» and grant «roles/iam.workloadIdentityUser».\n- Outside GKE (on-prem, other clouds) the same idea works through IAM Workload Identity Federation with the cluster's OIDC issuer.\n\nFor data engineering this is the pattern that lets Airflow tasks or Spark pods on GKE query BigQuery with no key files at all.",
      files: [
        {
          name: 'gcs-check.yaml',
          code: 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: crew\n---\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: bucket-reader\n  namespace: crew\n---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: gcs-check\n  namespace: crew\nspec:\n  serviceAccountName: bucket-reader\n  containers:\n  - name: cli\n    image: google/cloud-sdk:slim\n    command: ["sleep", "infinity"]',
          notes: [
            [
              'name: bucket-reader',
              'The Kubernetes identity IAM will trust. No Google service account, no key.',
            ],
            [
              'serviceAccountName: bucket-reader',
              "The pod's token says crew/bucket-reader, which IAM maps to the principal above.",
            ],
            [
              'google/cloud-sdk:slim',
              'gcloud inside the pod picks up credentials from the metadata server automatically.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: "These steps need a GKE cluster, so you'll run them in the capstone's second part. Read through them now; on GKE they take five minutes.",
          cloud: true,
        },
        {
          text: 'Create a bucket with one file in it.',
          code: 'PROJECT_ID=$(gcloud config get-value project)\nPROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format=\'value(projectNumber)\')\nBUCKET=$PROJECT_ID-kq-cargo\ngcloud storage buckets create gs://$BUCKET --location=asia-south1\necho "manifest: 1200 tons of tea" | gcloud storage cp - gs://$BUCKET/manifest.txt',
          cloud: true,
        },
        {
          text: 'Grant read access directly to the Kubernetes ServiceAccount.',
          code: 'gcloud storage buckets add-iam-policy-binding gs://$BUCKET --role=roles/storage.objectViewer --member="principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$PROJECT_ID.svc.id.goog/subject/ns/crew/sa/bucket-reader"',
          cloud: true,
        },
        {
          text: 'Create «gcs-check.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'gcs-check.yaml',
        },
        {
          text: 'Run the pod and read the bucket. No key exists anywhere.',
          code: 'kubectl apply -f gcs-check.yaml\nkubectl wait --for=condition=Ready pod/gcs-check -n crew --timeout=180s\nkubectl exec -n crew gcs-check -- gcloud storage cat gs://$BUCKET/manifest.txt',
          output: 'manifest: 1200 tons of tea',
          cloud: true,
        },
        {
          text: "Prove it's the identity doing the work: the same command from a pod using the default ServiceAccount fails.",
          code: 'kubectl run nokey -n crew --rm -it --restart=Never --image=google/cloud-sdk:slim -- gcloud storage cat gs://$BUCKET/manifest.txt',
          output:
            'ERROR: (gcloud.storage.cat) [….svc.id.goog] does not have storage.objects.get access …',
          cloud: true,
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'Which IAM member identifies Kubernetes ServiceAccount «bucket-reader» in namespace «crew» on a GKE cluster in project «acme-data» (number 1234567890)?',
          options: [
            'principal://iam.googleapis.com/projects/1234567890/locations/global/workloadIdentityPools/acme-data.svc.id.goog/subject/ns/crew/sa/bucket-reader',
            'serviceAccount:bucket-reader@acme-data.iam.gserviceaccount.com',
            'user:crew/bucket-reader@acme-data',
            'principal://iam.googleapis.com/projects/acme-data/serviceAccounts/crew/bucket-reader',
          ],
          answers: [0],
          why: 'The principal uses the project number for the IAM path, the project ID in the pool name, then the namespace and the KSA name. The Google service account form is the older, separate mechanism.',
        },
      ],
    },
  ],
  mission: {
    title: 'Least-privilege identity',
    brief: 'Give each workload exactly the identity it needs.',
    tasks: [
      "tugboat in crew can list pods in crew through /peers and nothing more (kubectl auth can-i proves it can't delete pods)",
      'A second Deployment in crew that never calls the API runs with automountServiceAccountToken: false',
      'You minted a 10-minute token with a custom audience and read its claims',
      'Stretch (GKE): a pod reads a bucket through Workload Identity Federation, and a pod with the default ServiceAccount is refused',
    ],
    solution:
      'kubectl auth can-i delete pods -n crew --as=system:serviceaccount:crew:navigator   # no\nkubectl create deployment quiet -n crew --image=tugboat:v1\nkubectl patch deployment quiet -n crew -p \'{"spec":{"template":{"spec":{"automountServiceAccountToken":false}}}}\'\nkubectl exec -n crew deploy/quiet -- ls /var/run/secrets/kubernetes.io/serviceaccount   # No such file or directory',
  },
  cleanup: 'kubectl delete namespace crew',
};
