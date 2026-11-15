/**
 * Port 3: Networking. Find each other. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'networking',
  number: 3,
  title: 'Networking',
  tag: 'Find each other',
  hue: 4,
  dir: 'module_03_networking',
  story:
    'Wednesday. The billing team wants to call tugboat. "What\'s its IP?" "Which one? They change every time a pod is replaced." Today you give tugboat a stable name, open it to your Windows browser, and put several apps behind one front door.',
  lessons: [
    {
      slug: 'services',
      title: 'Services: a stable name for moving pods',
      pain: "Every replacement pod gets a new IP. You can't hardcode pod IPs, and you can't load-balance across them by hand.",
      fix: "So you use a **Service**: one stable virtual IP and DNS name that finds pods by label, not by IP. Pods come and go; the Service doesn't care.",
      body: 'A Service (type «ClusterIP» by default) gets a virtual IP that never changes. Behind it, the cluster keeps an **EndpointSlice** listing the IPs of the pods that match the selector and are Ready. On every node, kube-proxy programs packet rules so traffic to the Service IP lands on one of those pods.\n\nCoreDNS gives every Service a name: «tugboat» from the same namespace, «tugboat.default» from another namespace, or the full «tugboat.default.svc.cluster.local».\n\n- «port»: what clients call (80 here). «targetPort»: where the container listens (8080).\n- No matching Ready pods means an empty EndpointSlice, and connections are refused.\n- A **headless** Service («clusterIP: None») skips the virtual IP and returns pod IPs from DNS. StatefulSets use it (Port 05).',
      docker: [
        ['docker network create + container name DNS', 'Service name DNS'],
        ['Compose: ports between services', 'port / targetPort'],
      ],
      files: [
        {
          name: 'deploy.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: tugboat\n  labels:\n    app: tugboat\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: tugboat\n  template:\n    metadata:\n      labels:\n        app: tugboat\n    spec:\n      containers:\n      - name: tugboat\n        image: tugboat:v1\n        ports:\n        - containerPort: 8080',
          notes: [],
          collapsed: true,
        },
        {
          name: 'svc.yaml',
          code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat\nspec:\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080',
          notes: [
            [
              'name: tugboat',
              'Becomes the DNS name. Clients in this namespace just call http://tugboat.',
            ],
            [
              'selector:',
              'Any Ready pod with app=tugboat becomes an endpoint, whichever Deployment created it.',
            ],
            ['port: 80', 'The port clients use on the Service IP.'],
            ['targetPort: 8080', 'The port the container actually listens on.'],
          ],
        },
      ],
      sim: 'selector',
      lab: [
        {
          text: 'Set up the folder and write both files.',
          code: 'mkdir -p ~/kube-quest/module_03_networking && cd ~/kube-quest/module_03_networking',
        },
        {
          text: 'Create «deploy.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'deploy.yaml',
        },
        {
          text: 'Create «svc.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'svc.yaml',
        },
        {
          text: 'Apply them and inspect the Service and its endpoints.',
          code: 'kubectl apply -f deploy.yaml -f svc.yaml\nkubectl get svc tugboat\nkubectl get endpointslices -l kubernetes.io/service-name=tugboat',
          output:
            'NAME      TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE\ntugboat   ClusterIP   10.96.142.17   <none>        80/TCP    5s\nNAME            ADDRESSTYPE   PORTS   ENDPOINTS\ntugboat-x7k2p   IPv4          8080    10.244.1.4,10.244.2.3,10.244.1.5',
        },
        {
          text: "Start a throwaway client pod. You'll get a shell inside the cluster.",
          code: 'kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- sh',
        },
        {
          text: 'Inside that shell, call the Service by name a few times and look it up in DNS.',
          code: 'for i in 1 2 3 4 5 6; do wget -qO- http://tugboat; done\nnslookup tugboat',
          output:
            'Ahoy from tugboat v1 | pod tugboat-7c9d8f6b5-2xk9q | path / | visits 4 (file /data/visits)\nAhoy from tugboat v1 | pod tugboat-7c9d8f6b5-lp4vd | path / | visits 2 (file /data/visits)\n…\nName:\ttugboat.default.svc.cluster.local\nAddress: 10.96.142.17',
        },
        {
          text: 'Leave the busybox shell open. From your first terminal, replace every pod at once.',
          code: 'kubectl delete pod -l app=tugboat\nkubectl get svc tugboat\nkubectl get endpointslices -l kubernetes.io/service-name=tugboat',
          predict: {
            prompt:
              'You delete all tugboat pods. When the replacements are up, has the Service IP changed?',
            options: [
              'No: the Service IP is stable; only the endpoints behind it changed',
              "Yes: the Service follows the newest pod's IP",
              'The Service is deleted along with its pods',
              'Yes, and DNS updates after about a minute',
            ],
            answers: [0],
            why: 'The Service is its own object with its own IP. Its EndpointSlice is rewritten as pods come and go, so clients never notice.',
          },
        },
        {
          text: 'Break the selector with a typo, then call again from the busybox shell.',
          code: 'kubectl patch svc tugboat -p \'{"spec":{"selector":{"app":"tugbot"}}}\'\nkubectl get endpointslices -l kubernetes.io/service-name=tugboat',
          output:
            "NAME            ADDRESSTYPE   PORTS     ENDPOINTS\ntugboat-x7k2p   IPv4          <unset>   <unset>\n# busybox: wget: can't connect to remote host (10.96.142.17): Connection refused",
          breakIt: true,
        },
        {
          text: 'Fix it, then type «exit» in the busybox shell (the pod deletes itself).',
          code: 'kubectl patch svc tugboat -p \'{"spec":{"selector":{"app":"tugboat"}}}\'',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'Service port 80, targetPort 8080. A pod in the same namespace wants to call it. What URL?',
          options: [
            'http://tugboat',
            'http://tugboat:8080',
            'http://<pod IP>:80',
            'http://localhost:80',
          ],
          answers: [0],
          why: 'Clients use the Service name and Service port (80 is the HTTP default). kube-proxy forwards to port 8080 on one of the Ready pods.',
        },
      ],
    },
    {
      slug: 'reach-from-outside',
      title: 'Reaching it from Windows: port-forward, NodePort, LoadBalancer',
      pain: 'A ClusterIP lives inside the cluster. Your Windows browser, your phone and your customers are all outside it.',
      fix: 'So you expose it: **port-forward** for quick debugging, **NodePort** to open the same port on every node, **LoadBalancer** to get a real external IP from the cloud.',
      body: "| Way in | How it works | Use it for |\n|---|---|---|\n| «kubectl port-forward» | Tunnels through the API server to one pod | Debugging from your laptop |\n| «NodePort» | Opens a port (30000–32767) on every node | Labs, on-prem, building block for load balancers |\n| «LoadBalancer» | A cloud controller provisions an external load balancer | Exposing one service on a cloud |\n| Ingress / Gateway | One load balancer with routing rules for many services | Next two lessons |\n\nEach type builds on the last: a LoadBalancer Service is also a NodePort and a ClusterIP. On GKE, a LoadBalancer Service gets a Google Cloud load balancer with a public IP. kind has no cloud, so its EXTERNAL-IP stays «<pending>» until you run **cloud-provider-kind**, a small controller that does the cloud's job using Docker containers.\n\nThe catch from the story: ten LoadBalancer Services means ten load balancers on your cloud bill, even when six of them barely see traffic.",
      files: [
        {
          name: 'svc-nodeport.yaml',
          code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat-nodeport\nspec:\n  type: NodePort\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080\n    nodePort: 30080',
          notes: [
            ['type: NodePort', 'Adds a port on every node on top of the ClusterIP.'],
            [
              'nodePort: 30080',
              'Fixed so it matches the port your kind config mapped to localhost. Leave it out and Kubernetes picks a random one.',
            ],
          ],
        },
        {
          name: 'svc-lb.yaml',
          code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: tugboat-lb\nspec:\n  type: LoadBalancer\n  selector:\n    app: tugboat\n  ports:\n  - port: 80\n    targetPort: 8080',
          notes: [
            [
              'type: LoadBalancer',
              "Asks a cloud controller for an external load balancer. On GKE that's a Google Cloud network load balancer.",
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Port-forward to the Service (it still picks just one pod).',
          code: 'kubectl port-forward svc/tugboat 8080:80',
          secondTerminal: true,
        },
        {
          text: 'Create «svc-nodeport.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'svc-nodeport.yaml',
        },
        {
          text: "Apply it and open **http://localhost:30080** in your Windows browser. Refresh a few times and watch the pod name change: that's real load balancing.",
          code: "kubectl apply -f svc-nodeport.yaml\nfor i in 1 2 3 4; do curl -s localhost:30080 | cut -d'|' -f2; done",
          browser: true,
        },
        {
          text: 'Create «svc-lb.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'svc-lb.yaml',
        },
        {
          text: 'Ask for a load balancer.',
          code: 'kubectl apply -f svc-lb.yaml && kubectl get svc tugboat-lb',
          output:
            'NAME         TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)        AGE\ntugboat-lb   LoadBalancer   10.96.88.201   <pending>     80:31544/TCP   4s',
          predict: {
            prompt:
              'You create a LoadBalancer Service on kind with nothing else installed. What does EXTERNAL-IP show?',
            options: [
              '<pending> forever: no cloud controller exists to provision one',
              "Your laptop's IP",
              "The control-plane node's IP",
              'An error on apply',
            ],
            answers: [0],
            why: "The Service is valid, but provisioning is the cloud controller's job. On GKE that controller exists; on kind you add cloud-provider-kind.",
          },
        },
        {
          text: 'Start cloud-provider-kind as a container on the kind network. It stays running for the rest of the course.',
          code: 'docker run -d --name cloud-provider-kind --restart unless-stopped --network kind -v /var/run/docker.sock:/var/run/docker.sock registry.k8s.io/cloud-provider-kind/cloud-controller-manager:v0.11.1 -enable-lb-port-mapping\nkubectl get svc tugboat-lb -w',
          output: 'tugboat-lb   LoadBalancer   10.96.88.201   172.18.0.6   80:31544/TCP   40s',
        },
        {
          text: 'Call the external IP from WSL. This works when Docker Engine runs inside WSL; with Docker Desktop, use the mapped port in the next step instead.',
          code: "LB=$(kubectl get svc tugboat-lb -o jsonpath='{.status.loadBalancer.ingress[0].ip}')\ncurl -s $LB",
        },
        {
          text: 'Every load balancer is an Envoy container named «kindccm-…». Its mapped localhost port works from the Windows browser.',
          code: "docker ps --filter name=kindccm --format '{{.Names}}  {{.Ports}}'",
          output:
            'kindccm-a1b2c3d4  0.0.0.0:37121->80/tcp, 0.0.0.0:36673->10000/tcp\n# open http://localhost:37121 in Windows',
          browser: true,
        },
        {
          text: "If the IP never appears, the controller's log says why.",
          code: 'docker logs cloud-provider-kind --tail 20',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'Which Service type gives you a real external IP address on GKE?',
          options: ['LoadBalancer', 'ClusterIP', 'NodePort', 'Headless'],
          answers: [0],
          why: "GKE's cloud controller sees type LoadBalancer and provisions a Google Cloud load balancer with an external IP. ClusterIP stays internal and NodePort only opens node ports.",
        },
      ],
    },
    {
      slug: 'ingress',
      title: 'Ingress: one front door, many rooms',
      pain: 'Ten services, ten load balancers, ten line items on the bill, and six of them almost idle.',
      fix: 'So you use **Ingress**: one entry point with host and path rules that route to many Services. And because an Ingress is only a set of rules, you also need an **Ingress controller** that reads them and does the routing.',
      body: 'An Ingress object says "requests for «/tugboat» go to Service «tugboat»". It does nothing until a controller watches Ingress objects and configures a real proxy or cloud load balancer. The «ingressClassName» field (or the cluster\'s default IngressClass) decides which controller handles it.\n\nOn kind, cloud-provider-kind is also an Ingress controller: it registers a default IngressClass and implements each Ingress with an Envoy container. On GKE, the built-in controller turns an Ingress into a Google Cloud Application Load Balancer.',
      note: "**Keep up with the ecosystem.** Many tutorials still install the community «ingress-nginx» controller. That project was retired in March 2026 and no longer gets fixes; its maintainers point new users to Gateway API (next lesson). The Ingress API itself is still fully supported, and maintained controllers include GKE's own, Traefik, HAProxy, Kong and F5's NGINX Ingress Controller.",
      files: [
        {
          name: 'dinghy.yaml',
          code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: dinghy\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: dinghy\n  template:\n    metadata:\n      labels:\n        app: dinghy\n    spec:\n      containers:\n      - name: dinghy\n        image: tugboat:v2\n        env:\n        - name: GREETING\n          value: "Dinghy says hi"\n        ports:\n        - containerPort: 8080\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: dinghy\nspec:\n  selector:\n    app: dinghy\n  ports:\n  - port: 80\n    targetPort: 8080',
          notes: [],
          collapsed: true,
        },
        {
          name: 'ingress.yaml',
          code: 'apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: harbor\nspec:\n  rules:\n  - http:\n      paths:\n      - path: /tugboat\n        pathType: Prefix\n        backend:\n          service:\n            name: tugboat\n            port:\n              number: 80\n      - path: /dinghy\n        pathType: Prefix\n        backend:\n          service:\n            name: dinghy\n            port:\n              number: 80',
          notes: [
            [
              'kind: Ingress',
              'Just routing rules. Nothing happens until a controller acts on them.',
            ],
            ['rules:', 'Add host: shop.example.com to route by hostname as well as path.'],
            ['pathType: Prefix', '/tugboat matches /tugboat, /tugboat/ and /tugboat/anything.'],
            ['name: tugboat', 'The backend is a Service, never pods directly.'],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «dinghy.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'dinghy.yaml',
        },
        {
          text: 'Create «ingress.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'ingress.yaml',
        },
        {
          text: 'Prove that rules alone do nothing: stop the controller, then create the Ingress.',
          code: 'docker stop cloud-provider-kind\nkubectl apply -f dinghy.yaml -f ingress.yaml\nkubectl get ingress harbor',
          output:
            'NAME     CLASS    HOSTS   ADDRESS   PORTS   AGE\nharbor   <none>   *                 80      6s',
          predict: {
            prompt:
              'With no controller running, you apply the Ingress. What does its ADDRESS column show?',
            options: [
              'Nothing: it stays empty because no controller has picked it up',
              'The Service IP of tugboat',
              'An error: Ingress requires a controller to exist first',
              'localhost',
            ],
            answers: [0],
            why: 'The API server happily stores the rules. The ADDRESS is filled in by a controller once it has actually provisioned something.',
          },
        },
        {
          text: 'Start the controller again and watch the address arrive.',
          code: 'docker start cloud-provider-kind\nkubectl get ingressclass\nkubectl get ingress harbor -w',
        },
        {
          text: 'One IP, two apps.',
          code: "IP=$(kubectl get ingress harbor -o jsonpath='{.status.loadBalancer.ingress[0].ip}')\ncurl -s $IP/tugboat\ncurl -s $IP/dinghy",
          output:
            'Ahoy from tugboat v1 | pod tugboat-7c9d8f6b5-2xk9q | path /tugboat | visits 9 (file /data/visits)\nDinghy says hi from tugboat v2 | pod dinghy-5b8c7d9f4-qq2lm | path /dinghy | visits 1 (file /data/visits)',
        },
        {
          text: "With Docker Desktop, use the kindccm container's mapped port instead of the IP (docker ps as in the previous lesson).",
          browser: true,
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            "You create an Ingress and its ADDRESS stays empty for an hour. What's the most likely cause?",
          options: [
            "No Ingress controller is running, or the ingressClassName points to one that isn't installed",
            'The Service has the wrong port',
            "DNS for the host isn't configured",
            "The pods aren't Ready",
          ],
          answers: [0],
          why: 'Backend problems show up as errors when you call the address. An empty ADDRESS means no controller has accepted the Ingress at all.',
        },
      ],
    },
    {
      slug: 'gateway-api',
      title: 'Gateway API: Ingress, grown up',
      pain: "Ingress grew up on annotations: every controller invented its own for timeouts, canaries and header routing, and one object mixed the platform team's concerns with every app team's.",
      fix: "So you use the **Gateway API**: a GatewayClass (who implements it), a Gateway (the entry point the platform team owns) and HTTPRoutes (each app team's routing), with traffic splitting built in.",
      body: '| Resource | Owned by | Says |\n|---|---|---|\n| **GatewayClass** | Infrastructure provider | "cloud-provider-kind implements Gateways" (on GKE: «gke-l7-global-external-managed») |\n| **Gateway** | Platform team | "Listen on port 80 (and 443 with this certificate)" |\n| **HTTPRoute** | App team | "Send /tugboat to this Service, 90% v1 and 10% v2" |\n| **ReferenceGrant** | The target namespace | "Routes from namespace X may point at my Services" |\n\nWeights, header matches, redirects and rewrites are part of the standard API, so the same YAML works on kind and on GKE; only the «gatewayClassName» changes. Gateway API reached v1 in 2023 and is where new routing features land.',
      files: [
        {
          name: 'gateway.yaml',
          code: 'apiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: harbor-gw\nspec:\n  gatewayClassName: cloud-provider-kind\n  listeners:\n  - name: http\n    protocol: HTTP\n    port: 80\n---\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: canary\nspec:\n  parentRefs:\n  - name: harbor-gw\n  rules:\n  - backendRefs:\n    - name: tugboat\n      port: 80\n      weight: 90\n    - name: dinghy\n      port: 80\n      weight: 10',
          notes: [
            [
              'gatewayClassName: cloud-provider-kind',
              "Which implementation provisions this Gateway. On GKE you'd write gke-l7-global-external-managed.",
            ],
            ['listeners:', 'Ports and protocols the entry point accepts.'],
            [
              'parentRefs:',
              'Attaches this route to the Gateway. A typo here leaves the route unattached.',
            ],
            [
              'weight: 90',
              '90% of requests to tugboat, 10% to dinghy: a canary release without any annotations.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Check which GatewayClasses exist.',
          code: 'kubectl get gatewayclass',
          output:
            'NAME                  CONTROLLER                                      ACCEPTED\ncloud-provider-kind   kind.sigs.k8s.io/gateway-controller             True',
        },
        {
          text: 'Create «gateway.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'gateway.yaml',
        },
        {
          text: 'Apply it and wait for PROGRAMMED to say True.',
          code: 'kubectl apply -f gateway.yaml\nkubectl get gateway harbor-gw -w',
          output:
            'NAME        CLASS                 ADDRESS      PROGRAMMED   AGE\nharbor-gw   cloud-provider-kind   172.18.0.8   True         20s',
        },
        {
          text: 'Send 50 requests and count who answered.',
          code: "GW=$(kubectl get gateway harbor-gw -o jsonpath='{.status.addresses[0].value}')\nfor i in $(seq 1 50); do curl -s $GW/ | cut -d'|' -f1; done | sort | uniq -c",
          output: '      5 Dinghy says hi from tugboat v2\n     45 Ahoy from tugboat v1',
          predict: {
            prompt: 'Out of 50 requests with a 90/10 split, roughly how many reach dinghy?',
            options: ['About 5', 'Exactly 10', 'About 25', '0 until dinghy is Ready for 5 minutes'],
            answers: [0],
            why: 'Weights are probabilities, so 10% of 50 is about 5, give or take. Exact counts vary run to run.',
          },
        },
        {
          text: 'Promote the canary: set both weights to 50, re-apply, and count again.',
          code: "sed -i 's/weight: 90/weight: 50/; s/weight: 10/weight: 50/' gateway.yaml\nkubectl apply -f gateway.yaml\nfor i in $(seq 1 50); do curl -s $GW/ | cut -d'|' -f1; done | sort | uniq -c",
        },
      ],
      checks: [
        {
          type: 'match',
          prompt: 'Match each Gateway API resource to who typically owns it.',
          pairs: [
            ['GatewayClass', 'Infrastructure provider'],
            ['Gateway', 'Platform or cluster operator'],
            ['HTTPRoute', 'Application team'],
            ['ReferenceGrant', 'Owner of the namespace being referenced'],
          ],
          why: 'Splitting the objects by role is the main design improvement over Ingress: app teams change routes without touching the shared entry point.',
        },
      ],
    },
  ],
  mission: {
    title: 'Open the harbor',
    brief: 'Expose tugboat every way you learned, then run a canary.',
    tasks: [
      'tugboat Deployment with 3 replicas behind a ClusterIP Service',
      'From a busybox pod in a new namespace called billing, reach it as tugboat.default',
      'See it at http://localhost:30080 in your Windows browser through the NodePort',
      'Canary 80/20 between tugboat and dinghy with an HTTPRoute, and verify it with a 50-request loop',
      'Switch to 100% dinghy, then back to 100% tugboat',
      'Break the Service selector, see the empty EndpointSlice, and fix it',
    ],
    solution:
      'kubectl apply -f deploy.yaml -f svc.yaml -f svc-nodeport.yaml -f dinghy.yaml\nkubectl create namespace billing\nkubectl run tmp -n billing --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- http://tugboat.default\n# canary: edit gateway.yaml weights to 80 and 20, then\nkubectl apply -f gateway.yaml\nGW=$(kubectl get gateway harbor-gw -o jsonpath=\'{.status.addresses[0].value}\')\nfor i in $(seq 1 50); do curl -s $GW/ | cut -d\'|\' -f1; done | sort | uniq -c\n# 100% dinghy: weight 0 for tugboat, 100 for dinghy; then the reverse\nkubectl patch svc tugboat -p \'{"spec":{"selector":{"app":"nope"}}}\'\nkubectl get endpointslices -l kubernetes.io/service-name=tugboat\nkubectl patch svc tugboat -p \'{"spec":{"selector":{"app":"tugboat"}}}\'\nkubectl delete namespace billing',
  },
  cleanup:
    'kubectl delete ingress harbor --ignore-not-found\nkubectl delete httproute canary --ignore-not-found\nkubectl delete gateway harbor-gw --ignore-not-found\nkubectl delete svc tugboat tugboat-nodeport tugboat-lb dinghy --ignore-not-found\nkubectl delete deployment tugboat dinghy --ignore-not-found\n# keep the cloud-provider-kind container running: later ports use it',
};
