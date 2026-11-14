/**
 * Port 8: Network Policies. Zero trust inside. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'netpol',
  number: 8,
  title: 'Network Policies',
  tag: 'Zero trust inside',
  hue: 2,
  dir: 'module_08_network_policies',
  story:
    'A penetration test report: "A compromised pod in any namespace could reach your database directly." They\'re right. By default the pod network is flat. Today you build walls inside the cluster and learn the trap that catches everyone who locks down egress.',
  lessons: [
    {
      slug: 'flat-network',
      title: 'The flat network',
      pain: 'By default every pod can reach every other pod in every namespace. A compromised frontend, or any pod at all, can talk straight to your database.',
      fix: "So you use **NetworkPolicies**: label-based firewall rules for pods, enforced by the cluster's network plugin.",
      body: '- A pod with **no** policy selecting it accepts everything. As soon as any policy with «policyTypes: [Ingress]» selects a pod, that pod accepts only what some policy allows. Egress works the same way, separately.\n- Policies are **additive**: allowed traffic is the union of every policy that selects the pod. There\'s no "deny" rule; you deny by selecting and not allowing.\n- Rules match by «podSelector», «namespaceSelector» (every namespace has the label «kubernetes.io/metadata.name») and «ipBlock», plus ports.\n- Policies are stateful: allowing a request automatically allows its reply.\n- They only work if the network plugin enforces them. kind\'s kindnet has done so since v0.24; GKE Autopilot uses Dataplane V2, which enforces them by default.',
      files: [
        {
          name: 'shop.yaml',
          code: 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: shop\n---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  namespace: shop\n  labels:\n    app: web\nspec:\n  containers:\n  - name: web\n    image: busybox:1.36\n    command: ["sleep", "infinity"]\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\n  namespace: shop\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: api\n  template:\n    metadata:\n      labels:\n        app: api\n    spec:\n      containers:\n      - name: api\n        image: tugboat:v1\n        env:\n        - name: GREETING\n          value: "api"\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: api\n  namespace: shop\nspec:\n  selector:\n    app: api\n  ports:\n  - port: 8080\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: db\n  namespace: shop\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: db\n  template:\n    metadata:\n      labels:\n        app: db\n    spec:\n      containers:\n      - name: db\n        image: tugboat:v2\n        env:\n        - name: GREETING\n          value: "db (pretend this is Postgres)"\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: db\n  namespace: shop\nspec:\n  selector:\n    app: db\n  ports:\n  - port: 8080\n---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: outside\n---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: intruder\n  namespace: outside\n  labels:\n    app: intruder\nspec:\n  containers:\n  - name: intruder\n    image: busybox:1.36\n    command: ["sleep", "infinity"]',
          notes: [
            ['name: web', 'A busybox client standing in for the frontend.'],
            ['name: api', 'tugboat playing the backend.'],
            [
              'name: db',
              'tugboat again, pretending to be the database. Only api should ever reach it.',
            ],
            ['name: outside', 'A different namespace with a pod that should reach nothing.'],
          ],
        },
      ],
      sim: 'netpol',
      lab: [
        {
          text: 'Set up the folder.',
          code: 'mkdir -p ~/kube-quest/module_08_network_policies && cd ~/kube-quest/module_08_network_policies',
        },
        {
          text: 'Create «shop.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'shop.yaml',
        },
        {
          text: 'Apply it and wait for everything to run.',
          code: 'kubectl apply -f shop.yaml\nkubectl wait --for=condition=Ready pod --all -n shop --timeout=120s\nkubectl wait --for=condition=Ready pod/intruder -n outside --timeout=120s',
        },
        {
          text: 'Define test helpers for this terminal: «t» runs wget from a busybox pod, «tp» calls from inside api, and «matrix» runs all five checks.',
          code: 't(){ kubectl exec -n "$1" "$2" -- wget -qO- -T 2 "$3" >/dev/null 2>&1 && echo "OK      $2 -> $3" || echo "BLOCKED $2 -> $3"; }\ntp(){ kubectl exec -n shop deploy/api -- python -c "import urllib.request,sys; urllib.request.urlopen(sys.argv[1], timeout=2)" "$1" >/dev/null 2>&1 && echo "OK      api -> $1" || echo "BLOCKED api -> $1"; }\nmatrix(){ t shop web http://api:8080; t shop web http://db:8080; t outside intruder http://api.shop:8080; t outside intruder http://db.shop:8080; tp http://db:8080; }',
        },
        {
          text: 'Run the matrix.',
          code: 'matrix',
          output:
            'OK      web -> http://api:8080\nOK      web -> http://db:8080\nOK      intruder -> http://api.shop:8080\nOK      intruder -> http://db.shop:8080\nOK      api -> http://db:8080',
          predict: {
            prompt: 'No policies exist yet. Which of the five connections succeed?',
            options: [
              'All five, including the intruder reaching the database',
              'Only connections within the shop namespace',
              'None until you add an allow policy',
              'Only web to api',
            ],
            answers: [0],
            why: "Without policies the pod network is completely open across namespaces. That's the finding in the pen-test report.",
          },
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            "Pod A is selected by one ingress policy that allows traffic from pods labelled app=web. Pod B, in the same namespace, isn't selected by any policy. Who can reach pod B?",
          options: [
            'Everyone: pods not selected by any policy stay open',
            'Only app=web pods',
            'Nobody',
            'Only pods in the same namespace',
          ],
          answers: [0],
          why: "Isolation is per pod and only starts when a policy selects that pod. That's why default-deny policies select every pod with podSelector: {}.",
        },
      ],
    },
    {
      slug: 'default-deny',
      title: 'Default deny, then allow',
      pain: "Writing a rule for every bad path is impossible. You can't list every pod that shouldn't reach your database.",
      fix: 'So you start from **default deny** and open only the paths the app actually needs.',
      body: "An empty «podSelector: {}» selects every pod in the namespace, so a policy with no ingress rules denies all incoming traffic to all of them. Then add one small policy per allowed path.\n\n### The AND versus OR trap\n\nInside «from», each list item (each «-») is a separate source, and they're OR-ed. Two selectors in the same item are AND-ed.\n\n| YAML under «from:» | Allows |\n|---|---|\n| «- namespaceSelector: {…team: shop}» «  podSelector: {…app: web}» | web pods **in** shop namespaces (AND) |\n| «- namespaceSelector: {…team: shop}» «- podSelector: {…app: web}» | **every** pod in shop namespaces, **or** web pods in this namespace (OR) |\n\nOne dash changes the meaning completely, and both versions are valid YAML.",
      files: [
        {
          name: 'ingress-policies.yaml',
          code: 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-ingress\n  namespace: shop\nspec:\n  podSelector: {}\n  policyTypes:\n  - Ingress\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: api-from-web\n  namespace: shop\nspec:\n  podSelector:\n    matchLabels:\n      app: api\n  policyTypes:\n  - Ingress\n  ingress:\n  - from:\n    - podSelector:\n        matchLabels:\n          app: web\n    ports:\n    - protocol: TCP\n      port: 8080\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: db-from-api\n  namespace: shop\nspec:\n  podSelector:\n    matchLabels:\n      app: db\n  policyTypes:\n  - Ingress\n  ingress:\n  - from:\n    - podSelector:\n        matchLabels:\n          app: api\n    ports:\n    - protocol: TCP\n      port: 8080',
          notes: [
            [
              'podSelector: {}',
              'Selects every pod in shop. With no ingress rules, that means deny all incoming.',
            ],
            ['name: api-from-web', 'Reopens exactly one path: web to api on port 8080.'],
            [
              '- podSelector:',
              "With no namespaceSelector, this means pods in the policy's own namespace only.",
            ],
            [
              'port: 8080',
              "The pod's port, not the Service's port. Policies see traffic after the Service translated it.",
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «ingress-policies.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'ingress-policies.yaml',
        },
        {
          text: 'Apply only the default deny first. Delete the other two documents from a copy, or apply the file and then delete the two allow policies.',
          code: 'cd ~/kube-quest/module_08_network_policies\nkubectl apply -f ingress-policies.yaml\nkubectl delete networkpolicy api-from-web db-from-api -n shop',
        },
        {
          text: 'Run the connection matrix from the last lesson again.',
          code: 'matrix',
          output:
            'BLOCKED web -> http://api:8080\nBLOCKED web -> http://db:8080\nBLOCKED intruder -> http://api.shop:8080\nBLOCKED intruder -> http://db.shop:8080\nBLOCKED api -> http://db:8080',
          predict: {
            prompt: 'Only default-deny-ingress is active in shop. What does the matrix show?',
            options: [
              'Every connection into shop is BLOCKED, even web to api',
              'Only the intruder is blocked',
              'Nothing changes until you restart the pods',
              'Only db is protected',
            ],
            answers: [0],
            why: 'Every pod in shop is now isolated for ingress, and nothing has been allowed yet. Policies take effect without restarting pods.',
          },
        },
        {
          text: 'Open the two legitimate paths.',
          code: 'kubectl apply -f ingress-policies.yaml\nkubectl get networkpolicy -n shop\nmatrix',
          output:
            'OK      web -> http://api:8080\nBLOCKED web -> http://db:8080\nBLOCKED intruder -> http://api.shop:8080\nBLOCKED intruder -> http://db.shop:8080\nOK      api -> http://db:8080',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'Under «from:» you write one list item containing both a namespaceSelector and a podSelector. What does it allow?',
          options: [
            'Pods matching the podSelector that are also in namespaces matching the namespaceSelector',
            'Any pod matching either selector',
            "Only pods in the policy's own namespace",
            "Nothing; you can't combine selectors",
          ],
          answers: [0],
          why: 'Selectors in the same item are AND-ed. Splitting them into two items (two dashes) turns it into an OR, which is usually much more open than intended.',
        },
      ],
    },
    {
      slug: 'egress-dns',
      title: 'Egress and the DNS trap',
      pain: "Ingress rules stop people getting in. But a compromised api pod can still call anything: other namespaces, the cloud metadata service, an attacker's server on the internet. You add default-deny egress, and suddenly nothing in the namespace can even resolve a name.",
      fix: 'So you add **default-deny egress** plus an explicit allow for DNS to kube-dns, then open only the outbound paths each app needs.',
      body: 'Every name lookup («api», «db.shop», «googleapis.com») goes to the kube-dns pods in «kube-system» on UDP and TCP port 53. Default-deny egress blocks that too, so clients fail with "bad address" before they even try to connect. It\'s the most common NetworkPolicy outage, and the error doesn\'t mention policies at all.\n\nAllowing DNS needs a namespaceSelector for kube-system **and** a podSelector for «k8s-app: kube-dns» in the same list item.',
      files: [
        {
          name: 'egress-policies.yaml',
          code: 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny-egress\n  namespace: shop\nspec:\n  podSelector: {}\n  policyTypes:\n  - Egress\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-dns\n  namespace: shop\nspec:\n  podSelector: {}\n  policyTypes:\n  - Egress\n  egress:\n  - to:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: kube-system\n      podSelector:\n        matchLabels:\n          k8s-app: kube-dns\n    ports:\n    - protocol: UDP\n      port: 53\n    - protocol: TCP\n      port: 53\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: web-egress-to-api\n  namespace: shop\nspec:\n  podSelector:\n    matchLabels:\n      app: web\n  policyTypes:\n  - Egress\n  egress:\n  - to:\n    - podSelector:\n        matchLabels:\n          app: api\n    ports:\n    - protocol: TCP\n      port: 8080\n---\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: api-egress-to-db\n  namespace: shop\nspec:\n  podSelector:\n    matchLabels:\n      app: api\n  policyTypes:\n  - Egress\n  egress:\n  - to:\n    - podSelector:\n        matchLabels:\n          app: db\n    ports:\n    - protocol: TCP\n      port: 8080',
          notes: [
            ['name: default-deny-egress', 'Nothing in shop may open outbound connections.'],
            [
              'kubernetes.io/metadata.name: kube-system',
              'Kubernetes labels every namespace with its own name, so you can select it reliably.',
            ],
            [
              '      podSelector:',
              'Same list item as the namespaceSelector: kube-dns pods in kube-system (AND).',
            ],
            ['port: 53', 'DNS uses UDP and falls back to TCP for large answers. Allow both.'],
            [
              'name: web-egress-to-api',
              'Egress for web is now only api on 8080, plus DNS from the previous policy.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «egress-policies.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'egress-policies.yaml',
        },
        {
          text: 'Apply only the deny first, by applying the file and removing the three allows.',
          code: 'cd ~/kube-quest/module_08_network_policies\nkubectl apply -f egress-policies.yaml\nkubectl delete networkpolicy allow-dns web-egress-to-api api-egress-to-db -n shop',
        },
        {
          text: 'From the web pod, look up the name of the API, then call it.',
          code: 'kubectl exec -n shop web -- nslookup api\nkubectl exec -n shop web -- wget -qO- -T 2 http://api:8080',
          output: ";; connection timed out; no servers could be reached\nwget: bad address 'api'",
          predict: {
            prompt:
              'Only default-deny-egress is new. web calls http://api:8080. What error do you expect?',
            options: [
              "A DNS failure: the name api can't be resolved",
              'Connection refused from api',
              "A timeout connecting to api's IP",
              'It still works, because api-from-web allows it',
            ],
            answers: [0],
            why: "web can't even reach kube-dns, so wget fails at the lookup. The ingress policy on api never gets a chance to matter.",
          },
        },
        {
          text: 'Add the DNS allow, then the app paths, and rerun the matrix.',
          code: 'kubectl apply -f egress-policies.yaml\nkubectl exec -n shop web -- nslookup api\nmatrix',
          output:
            'Name:\tapi.shop.svc.cluster.local\nOK      web -> http://api:8080\nBLOCKED web -> http://db:8080\nBLOCKED intruder -> http://api.shop:8080\nBLOCKED intruder -> http://db.shop:8080\nOK      api -> http://db:8080',
        },
        {
          text: 'And the internet is closed to web now too.',
          code: 'kubectl exec -n shop web -- wget -qO- -T 3 http://example.com || echo "egress to the internet is blocked"',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'Right after applying a default-deny egress policy, what usually breaks first?',
          options: [
            'DNS resolution, because traffic to kube-dns is blocked too',
            'Liveness probes',
            'Image pulls',
            'Traffic between containers in the same pod',
          ],
          answers: [0],
          why: 'Every name lookup is an egress connection to kube-dns. Allow UDP and TCP 53 to it before anything else.',
        },
      ],
    },
  ],
  mission: {
    title: 'Zero-trust shop',
    brief: 'Leave shop with exactly the paths the app needs.',
    tasks: [
      'Final matrix: only web to api and api to db succeed',
      'Every pod in shop can still resolve names',
      'The intruder in outside reaches nothing in shop',
      "web can't reach the internet",
      "Explain in one sentence why db's ingress policy uses port 8080 and not the Service port",
    ],
    solution:
      "kubectl apply -f ingress-policies.yaml -f egress-policies.yaml\nmatrix\nkubectl exec -n shop web -- nslookup db\nkubectl exec -n shop web -- wget -qO- -T 3 http://example.com    # fails\n# Policies are evaluated on the pod's traffic after the Service has translated\n# port 8080 -> targetPort, so they always use the container port.",
  },
  cleanup: 'kubectl delete namespace shop outside',
};
