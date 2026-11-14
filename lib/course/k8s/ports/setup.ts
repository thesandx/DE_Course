/**
 * Port 0: Shipyard setup. Rig the ship. See lib/course/k8s/README.md.
 */

import type { K8sPort } from '@/types/k8s';

export const port: K8sPort = {
  slug: 'setup',
  number: 0,
  title: 'Shipyard setup',
  tag: 'Rig the ship',
  hue: 1,
  dir: 'setup',
  story:
    "You already know Docker: build an image, run it, it works on your machine. This course takes one image you build yourself and turns it into a self-healing, autoscaling, locked-down fleet, first on your laptop and then on Google Kubernetes Engine. Before you sail, rig the ship: check Docker in WSL, install two tools, start a three-node cluster, and build the app you'll use in every lesson.",
  lessons: [
    {
      slug: 'engine-room',
      title: 'Check the engine room',
      pain: "Kubernetes on a laptop needs a container engine and a Linux kernel it's happy with. Your WSL distro has both, but two settings decide whether the first cluster starts cleanly or fails with a cryptic kubelet error.",
      fix: 'So you use **kind** (Kubernetes in Docker): every Kubernetes node is just a Docker container, so the Docker you already know is the foundation.',
      body: "There are three popular ways to run Kubernetes locally. This course uses **kind** because it starts a multi-node cluster in about a minute, deletes it in seconds, and is what the Kubernetes project itself uses to test Kubernetes.\n\n| Tool | How nodes run | Why not here |\n|---|---|---|\n| **kind** | Docker containers | Our pick: multi-node, fast, disposable |\n| minikube | A VM or a container | Fine, but heavier and add-on driven |\n| k3d | k3s in containers | k3s swaps in its own components (Traefik, SQLite) |\n\n### Two things to check in WSL\n\n- **Docker works**: Docker Desktop with WSL integration turned on, or Docker Engine installed directly in your distro. Both work with kind.\n- **cgroup v2**: since Kubernetes 1.35 the kubelet refuses to start on a cgroup v1 host by default. kind's default node image is Kubernetes 1.37, so check this first.\n- **Memory**: three nodes plus your apps fit in about 4 GB. If WSL feels starved, raise its limit in «%UserProfile%\\.wslconfig».",
      files: [],
      lab: [
        {
          text: 'Confirm the Docker daemon answers from WSL.',
          code: "docker version --format 'client {{.Client.Version}} / server {{.Server.Version}}'",
          output: 'client 28.x / server 28.x',
        },
        {
          text: 'Run a throwaway container end to end.',
          code: 'docker run --rm hello-world | head -3',
          output:
            'Hello from Docker!\nThis message shows that your installation appears to be working correctly.',
        },
        {
          text: 'Check the cgroup version. You want «cgroup2fs».',
          code: 'stat -fc %T /sys/fs/cgroup/',
          output: 'cgroup2fs',
        },
        {
          text: 'Only if you saw «tmpfs»: switch WSL to cgroup v2. Add these lines to «C:\\Users\\<you>\\.wslconfig» in Windows, then run «wsl --shutdown» from PowerShell and reopen your terminal.',
          code: '[wsl2]\nmemory=8GB\nkernelCommandLine = cgroup_no_v1=all',
          windowsFile: true,
        },
        {
          text: 'See what WSL gives you. kind nodes share these cores and this memory.',
          code: 'nproc && free -h | head -2',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'Your cluster uses Kubernetes 1.37 and your WSL kernel only offers cgroup v1. What happens?',
          options: [
            'The kubelet refuses to start, so nodes never become Ready',
            'Everything works, but memory limits are ignored',
            'kind silently installs Kubernetes 1.30 instead',
            "Pods start but can't reach each other",
          ],
          answers: [0],
          why: "From Kubernetes 1.35 the kubelet's failCgroupV1 setting defaults to true, so it won't start on a cgroup v1 host unless you opt back in. Switching WSL to cgroup v2 is the fix.",
        },
      ],
    },
    {
      slug: 'tools',
      title: 'Install the tools of the trade',
      pain: 'Docker has one CLI. Kubernetes splits the job: one tool creates clusters, another talks to them.',
      fix: 'So you install **kubectl**, the remote control for any Kubernetes cluster (kind today, GKE later), and **kind**, which creates local clusters.',
      body: "«kubectl» never touches containers directly. It sends requests to a cluster's **API server**, using the address and credentials in «~/.kube/config» (your kubeconfig). The same binary will drive your GKE cluster at the end of the course; only the context changes.\n\nThe alias «k» and tab completion save thousands of keystrokes. The labs spell out «kubectl» so they're easy to read, but type «k» if you like.",
      docker: [
        ['docker (CLI)', 'kubectl (CLI)'],
        ['Docker daemon', 'Kubernetes API server'],
        ['DOCKER_HOST / docker context', 'kubeconfig context'],
      ],
      files: [],
      lab: [
        {
          text: 'Install the latest stable kubectl.',
          code: 'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"\nsudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && rm kubectl\nkubectl version --client',
          output: 'Client Version: v1.37.x\nKustomize Version: v5.x',
        },
        {
          text: 'Install kind v0.33.0 (the current release, defaulting to Kubernetes 1.37).',
          code: '[ $(uname -m) = x86_64 ] && curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.33.0/kind-linux-amd64\nchmod +x ./kind && sudo mv ./kind /usr/local/bin/kind\nkind version',
          output: 'kind v0.33.0 go1.x linux/amd64',
        },
        {
          text: 'Add the «k» alias and tab completion to your shell.',
          code: "cat >> ~/.bashrc <<'EOF'\nsource <(kubectl completion bash)\nalias k=kubectl\ncomplete -o default -F __start_kubectl k\nEOF\nsource ~/.bashrc",
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt: 'What does kubectl actually talk to?',
          options: [
            'The Kubernetes API server named in your kubeconfig',
            'The Docker daemon on each node',
            'containerd on the control-plane node',
            'etcd, directly',
          ],
          answers: [0],
          why: 'Every kubectl command is an HTTPS request to the API server. The kubeconfig tells kubectl which server and which credentials to use.',
        },
      ],
    },
    {
      slug: 'kind-cluster',
      title: 'Launch a cluster made of containers',
      pain: 'A real cluster means several machines. You have one laptop.',
      fix: 'So you let kind start three Docker containers that each act as a Kubernetes node: one control plane and two workers.',
      body: "The config below asks for three nodes and maps port «30080» on your laptop to port «30080» on the control-plane container. In Port 03 that port becomes your window from the Windows browser into the cluster. Port mappings are fixed when the cluster is created, so we add it now.\n\nInside each node container runs **containerd**, the same runtime GKE nodes use, plus the kubelet. So you'll see containers running inside a container: your pods live inside the node containers, not directly in your Docker.",
      files: [
        {
          name: 'kind-kq.yaml',
          code: 'kind: Cluster\napiVersion: kind.x-k8s.io/v1alpha4\nname: kq\nnodes:\n- role: control-plane\n  extraPortMappings:\n  - containerPort: 30080\n    hostPort: 30080\n    protocol: TCP\n- role: worker\n- role: worker',
          notes: [
            [
              'name: kq',
              'The cluster name. kind prefixes node containers with it (kq-control-plane, kq-worker…) and names your kubectl context kind-kq.',
            ],
            [
              'role: control-plane',
              "Runs the API server, etcd, scheduler and controller manager. In kind it's tainted so your apps land on the workers.",
            ],
            [
              'extraPortMappings',
              'Like docker run -p: host port 30080 forwards into this node container. Only ports listed here at creation time are reachable from Windows.',
            ],
            [
              'role: worker',
              'Two workers let you see pods spread across nodes, and later survive a node going down.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «kind-kq.yaml». Paste the block: it writes the file into the folder of this port.',
          file: 'kind-kq.yaml',
        },
        {
          text: 'Create the cluster. This pulls the node image once, so the first run takes a few minutes.',
          code: 'kind create cluster --config kind-kq.yaml',
          output:
            'Creating cluster "kq" ...\n ✓ Ensuring node image (kindest/node:v1.37.0)\n ✓ Preparing nodes 📦 📦 📦\n ✓ Writing configuration\n ✓ Starting control-plane\n ✓ Installing CNI\n ✓ Installing StorageClass\n ✓ Joining worker nodes\nSet kubectl context to "kind-kq"',
        },
        {
          text: 'Meet your nodes.',
          code: 'kubectl get nodes -o wide',
          output:
            'NAME               STATUS   ROLES           AGE   VERSION   INTERNAL-IP\nkq-control-plane   Ready    control-plane   60s   v1.37.0   172.18.0.4\nkq-worker          Ready    <none>          40s   v1.37.0   172.18.0.2\nkq-worker2         Ready    <none>          40s   v1.37.0   172.18.0.3',
        },
        {
          text: 'Now look from the Docker side.',
          code: "docker ps --format 'table {{.Names}}\\t{{.Image}}\\t{{.Ports}}'",
          output:
            'NAMES              IMAGE                  PORTS\nkq-worker2         kindest/node:v1.37.0\nkq-control-plane   kindest/node:v1.37.0   0.0.0.0:30080->30080/tcp, 127.0.0.1:41235->6443/tcp\nkq-worker          kindest/node:v1.37.0',
          predict: {
            prompt: 'You run «docker ps». What do you expect to see?',
            options: [
              'Three containers: kq-control-plane, kq-worker and kq-worker2',
              'Dozens of containers, one per Kubernetes component',
              'Nothing; kind runs in a hidden VM',
              'One container holding the whole cluster',
            ],
            answers: [0],
            why: 'Each node is one Docker container. The Kubernetes components and your pods run inside those containers, managed by containerd, so plain docker ps only shows the three nodes.',
          },
        },
        {
          text: "Peek inside a node: containerd's own container list. «crictl» is the kubelet's view of containers.",
          code: 'docker exec kq-worker crictl ps',
          output:
            'CONTAINER     IMAGE          STATE     NAME          POD\n3f1c…         kindnetd…      Running   kindnet-cni   kindnet-7xq2d\n9a07…         kube-proxy…    Running   kube-proxy    kube-proxy-h8x5n',
        },
        {
          text: "Keep this rescue command handy. If you restart WSL or Docker and kubectl can't connect, start the node containers again.",
          code: 'docker start $(docker ps -aq --filter label=io.x-k8s.kind.cluster=kq)\nkubectl get nodes',
        },
      ],
      checks: [
        {
          type: 'match',
          prompt: 'Match each piece of your local setup to what it really is.',
          pairs: [
            ['A kind node', 'A Docker container'],
            ['The runtime inside each node', 'containerd'],
            ['kind-kq', 'A kubectl context in ~/.kube/config'],
            ['Port 30080 on your laptop', 'An extraPortMapping into the control-plane container'],
          ],
          why: 'kind maps Kubernetes concepts onto Docker ones: nodes are containers, pods run in containerd inside them, and only mapped ports reach your laptop.',
        },
      ],
    },
    {
      slug: 'tugboat-image',
      title: "Build the image you'll sail with",
      pain: 'Tutorials that use nginx teach nothing about your own apps. You need an app you control, with buttons to make it crash, hang, leak and burn CPU on demand.',
      fix: "So you build **tugboat**: a tiny Python web app (standard library only) that you'll deploy, scale, break and secure in every port.",
      body: "tugboat answers on port 8080. Every endpoint exists to demonstrate a Kubernetes behaviour you'll meet later.\n\n| Endpoint | What it does | Used in |\n|---|---|---|\n| «/» (any path) | Greeting, version, pod name, visit counter | Everywhere |\n| «/crash» | Exits with code 1 | Port 01 |\n| «/config» | Shows env vars, a mounted config file, masked secrets | Port 04 |\n| «/healthz» «/readyz» «/hang» «/toggle-ready» | Liveness and readiness behaviour | Port 06 |\n| «/burn?ms=100» «/leak?mb=50» | Burn CPU, hold memory | Port 06 |\n| «/whoami» «/peers» | Decode its ServiceAccount token, call the Kubernetes API | Port 09 |\n\nThe Dockerfile runs as a numbered non-root user (10001). That choice pays off in Port 07, when the cluster starts rejecting containers that run as root.",
      files: [
        {
          name: 'app.py',
          code: '"""tugboat: a tiny web app for learning Kubernetes. Standard library only.\n\nEndpoints\n  /            greeting, version, pod name, visit counter (any unknown path works too)\n  /healthz     liveness: fails while "hung" or before STARTUP_DELAY has passed\n  /readyz      readiness: fails while not ready, hung, or still starting\n  /toggle-ready  flip readiness (simulates a dependency outage)\n  /hang        make the app "deadlock" (liveness starts failing)\n  /crash       exit the process with code 1\n  /burn?ms=200 burn CPU for N milliseconds (for HPA load tests)\n  /leak?mb=50  allocate and keep N MiB of memory (for OOMKilled demos)\n  /config      show config from env vars, a mounted ConfigMap file and a Secret\n  /whoami      decode this pod\'s ServiceAccount token claims\n  /peers       list pods in this namespace via the Kubernetes API (needs RBAC)\n"""\nimport base64, json, os, signal, socket, ssl, sys, threading, time, urllib.request\nfrom http.server import BaseHTTPRequestHandler, ThreadingHTTPServer\nfrom urllib.parse import parse_qs, urlparse\n\nVERSION = os.environ.get("APP_VERSION", "v1")\nGREETING = os.environ.get("GREETING", "Ahoy")\nCOLOR = os.environ.get("COLOR", "#1f6feb")\nPORT = int(os.environ.get("PORT", "8080"))\nDATA_DIR = os.environ.get("DATA_DIR", "/data")\nSTARTUP_DELAY = float(os.environ.get("STARTUP_DELAY", "0"))\nCONFIG_FILE = os.environ.get("CONFIG_FILE", "/etc/tugboat/config/app.properties")\nSECRET_DIR = os.environ.get("SECRET_DIR", "/etc/tugboat/secret")\nSA_DIR = "/var/run/secrets/kubernetes.io/serviceaccount"\nHOST = socket.gethostname()\nSTART = time.time()\nstate = {"ready": True, "hung": False, "visits": 0}\nhog = []\nlock = threading.Lock()\n\n\ndef log(msg):\n    print(f"{time.strftime(\'%H:%M:%S\')} {HOST} {msg}", flush=True)\n\n\ndef started():\n    return time.time() - START >= STARTUP_DELAY\n\n\ndef bump_visits():\n    path = os.path.join(DATA_DIR, "visits")\n    with lock:\n        try:\n            n = int(open(path).read().strip() or 0) + 1\n            open(path, "w").write(str(n))\n            return n, f"file {path}"\n        except FileNotFoundError:\n            try:\n                open(path, "w").write("1")\n                return 1, f"file {path}"\n            except OSError:\n                pass\n        except (OSError, ValueError):\n            pass\n        state["visits"] += 1\n        return state["visits"], "memory"\n\n\ndef mask(v):\n    return (v[:2] + "*" * max(len(v) - 2, 3)) if v else v\n\n\ndef read_files(d):\n    out = {}\n    if os.path.isdir(d):\n        for name in sorted(os.listdir(d)):\n            p = os.path.join(d, name)\n            if os.path.isfile(p) and not name.startswith(".."):\n                try:\n                    out[name] = open(p).read().strip()\n                except OSError as e:\n                    out[name] = f"<{e}>"\n    return out\n\n\ndef jwt_claims(token):\n    try:\n        payload = token.split(".")[1]\n        payload += "=" * (-len(payload) % 4)\n        return json.loads(base64.urlsafe_b64decode(payload))\n    except Exception as e:  # noqa: BLE001\n        return {"error": str(e)}\n\n\nclass Handler(BaseHTTPRequestHandler):\n    server_version = "tugboat"\n\n    def log_message(self, fmt, *args):\n        pass\n\n    def send(self, code, body, ctype="text/plain; charset=utf-8"):\n        data = body.encode() if isinstance(body, str) else body\n        self.send_response(code)\n        self.send_header("Content-Type", ctype)\n        self.send_header("Content-Length", str(len(data)))\n        self.end_headers()\n        self.wfile.write(data)\n        log(f"{self.command} {self.path} {code}")\n\n    def send_json(self, code, obj):\n        self.send(code, json.dumps(obj, indent=2) + "\\n", "application/json")\n\n    def do_GET(self):\n        url = urlparse(self.path)\n        q = parse_qs(url.query)\n        p = url.path.rstrip("/") or "/"\n        if p == "/healthz":\n            if state["hung"]:\n                return self.send(500, "deadlocked\\n")\n            if not started():\n                return self.send(503, "still starting\\n")\n            return self.send(200, "ok\\n")\n        if p == "/readyz":\n            if not started():\n                return self.send(503, "still starting\\n")\n            if state["hung"] or not state["ready"]:\n                return self.send(503, "not ready\\n")\n            return self.send(200, "ready\\n")\n        if p == "/toggle-ready":\n            state["ready"] = not state["ready"]\n            return self.send(200, f"ready is now {state[\'ready\']}\\n")\n        if p == "/hang":\n            state["hung"] = True\n            return self.send(200, "tugboat is now deadlocked; liveness will fail\\n")\n        if p == "/crash":\n            self.send(200, "crashing with exit code 1\\n")\n            threading.Timer(0.2, lambda: os._exit(1)).start()\n            return\n        if p == "/burn":\n            ms = int(q.get("ms", ["200"])[0])\n            end = time.time() + ms / 1000\n            x = 0\n            while time.time() < end:\n                x += 1\n            return self.send(200, f"burned {ms}ms of CPU on {HOST}\\n")\n        if p == "/leak":\n            mb = int(q.get("mb", ["50"])[0])\n            hog.append(b"x" * (mb * 1024 * 1024))\n            total = sum(len(h) for h in hog) // (1024 * 1024)\n            return self.send(200, f"now holding {total} MiB on {HOST}\\n")\n        if p == "/config":\n            secrets = {k: mask(v) for k, v in read_files(SECRET_DIR).items()}\n            env_secret = os.environ.get("API_KEY")\n            return self.send_json(200, {\n                "pod": HOST,\n                "env": {"APP_VERSION": VERSION, "GREETING": GREETING, "COLOR": COLOR,\n                        "API_KEY": mask(env_secret) if env_secret else None},\n                "config_file": {CONFIG_FILE: open(CONFIG_FILE).read() if os.path.isfile(CONFIG_FILE) else None},\n                "secret_files": secrets,\n            })\n        if p == "/whoami":\n            tok_path = os.path.join(SA_DIR, "token")\n            if not os.path.isfile(tok_path):\n                return self.send(404, "no ServiceAccount token mounted (automountServiceAccountToken: false?)\\n")\n            claims = jwt_claims(open(tok_path).read().strip())\n            if "exp" in claims:\n                claims["expires_in_minutes"] = round((claims["exp"] - time.time()) / 60, 1)\n            return self.send_json(200, claims)\n        if p == "/peers":\n            try:\n                token = open(os.path.join(SA_DIR, "token")).read().strip()\n                ns = open(os.path.join(SA_DIR, "namespace")).read().strip()\n            except OSError:\n                return self.send(404, "no ServiceAccount token mounted\\n")\n            ctx = ssl.create_default_context(cafile=os.path.join(SA_DIR, "ca.crt"))\n            req = urllib.request.Request(\n                f"https://kubernetes.default.svc/api/v1/namespaces/{ns}/pods",\n                headers={"Authorization": f"Bearer {token}"})\n            try:\n                with urllib.request.urlopen(req, context=ctx, timeout=5) as r:\n                    items = json.load(r)["items"]\n                return self.send(200, "".join(f"{i[\'metadata\'][\'name\']}  {i[\'status\'].get(\'phase\')}\\n" for i in items))\n            except urllib.error.HTTPError as e:\n                return self.send(e.code, f"Kubernetes API said {e.code}: {e.read().decode()[:300]}\\n")\n        # main page (any other path)\n        n, where = bump_visits()\n        if "text/html" in (self.headers.get("Accept") or ""):\n            html = (f"<!doctype html><meta charset=utf-8><title>tugboat {VERSION}</title>"\n                    f"<body style=\'margin:0;font:20px system-ui;background:{COLOR};color:#fff;"\n                    f"display:grid;place-items:center;height:100vh;text-align:center\'>"\n                    f"<div><div style=\'font-size:64px\'>&#9875;</div><h1>{GREETING} from tugboat {VERSION}</h1>"\n                    f"<p>pod <b>{HOST}</b> &middot; path {url.path}</p><p>visits {n} (stored in {where})</p></div>")\n            return self.send(200, html, "text/html; charset=utf-8")\n        return self.send(200, f"{GREETING} from tugboat {VERSION} | pod {HOST} | path {url.path} | visits {n} ({where})\\n")\n\n\ndef main():\n    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)\n\n    def on_sigterm(*_):\n        log("SIGTERM received: finishing in-flight requests, then exiting")\n        threading.Thread(target=srv.shutdown, daemon=True).start()\n\n    signal.signal(signal.SIGTERM, on_sigterm)\n    log(f"tugboat {VERSION} listening on :{PORT} (startup delay {STARTUP_DELAY:g}s)")\n    srv.serve_forever()\n    log("bye")\n    sys.exit(0)\n\n\nif __name__ == "__main__":\n    main()',
          notes: [],
          collapsed: true,
        },
        {
          name: 'Dockerfile',
          code: 'FROM python:3.13-slim\nARG APP_VERSION=v1\nARG COLOR=#1f6feb\nENV APP_VERSION=$APP_VERSION COLOR=$COLOR PYTHONUNBUFFERED=1\nWORKDIR /app\nCOPY app.py .\nRUN useradd --uid 10001 --no-create-home tugboat && mkdir -p /data && chown 10001 /data\nUSER 10001\nEXPOSE 8080\nCMD ["python", "/app/app.py"]',
          notes: [
            [
              'FROM python',
              'A slim official Python base. No pip packages, so the build needs nothing but this.',
            ],
            [
              'ARG APP_VERSION',
              'Build arguments let one Dockerfile produce v1 and v2 with different versions and colours, which makes rollouts visible.',
            ],
            [
              'useradd --uid 10001',
              "A numeric non-root user. Kubernetes can verify runAsNonRoot only when the image's USER is numeric.",
            ],
            ['USER 10001', 'Everything after this runs unprivileged.'],
            [
              'EXPOSE 8080',
              'Documentation only, exactly as in Docker. Kubernetes uses containerPort and Service targetPort instead.',
            ],
          ],
        },
      ],
      lab: [
        {
          text: 'Create «app.py». Paste the block: it writes the file into the folder of this port.',
          file: 'app.py',
        },
        {
          text: 'Create «Dockerfile». Paste the block: it writes the file into the folder of this port.',
          file: 'Dockerfile',
        },
        {
          text: 'Build v1 (blue) and v2 (orange) from the same source.',
          code: "docker build -t tugboat:v1 .\ndocker build -t tugboat:v2 --build-arg APP_VERSION=v2 --build-arg COLOR='#c2410c' .",
        },
        {
          text: 'Test it the way you already know: plain Docker.',
          code: 'docker run --rm -d -p 8080:8080 --name tb tugboat:v1\nsleep 1 && curl -s localhost:8080 && docker rm -f tb',
          output: 'Ahoy from tugboat v1 | pod 5d2c1e9a7b31 | path / | visits 1 (file /data/visits)',
        },
        {
          text: "Copy both images into every kind node. kind nodes have their own containerd, so images in your Docker aren't visible to them until you load them.",
          code: 'kind load docker-image tugboat:v1 tugboat:v2 --name kq',
          output:
            'Image: "tugboat:v1" with ID "sha256:…" not yet present on node "kq-worker", loading...\nImage: "tugboat:v2" with ID "sha256:…" not yet present on node "kq-worker", loading...',
        },
        {
          text: 'Confirm a worker can see them.',
          code: 'docker exec kq-worker crictl images | grep tugboat',
          output:
            'docker.io/library/tugboat   v1   1b2c…   48.1MB\ndocker.io/library/tugboat   v2   7d8e…   48.1MB',
        },
        {
          text: "Only if «kind load» failed with a content digest not found error (Docker Desktop's containerd image store): load through an archive instead.",
          code: 'docker save tugboat:v1 tugboat:v2 -o tugboat.tar\nkind load image-archive tugboat.tar --name kq',
        },
      ],
      checks: [
        {
          type: 'choice',
          prompt:
            'A pod asks for «tugboat:v1», an image that exists on no registry. Why will it still start in your kind cluster?',
          options: [
            "You loaded it into each node's containerd, and a non-latest tag defaults to pull only if not present",
            'kind proxies image pulls to your local Docker daemon',
            'Kubernetes builds images from the Dockerfile automatically',
            'tugboat:v1 is published on Docker Hub',
          ],
          answers: [0],
          why: "kind load copied the image into every node. Because the tag isn't latest, imagePullPolicy defaults to IfNotPresent, so the kubelet uses the local copy instead of trying a registry.",
        },
      ],
    },
  ],
  mission: {
    title: 'Pre-flight checklist',
    brief: 'Prove the ship is seaworthy before Port 01.',
    tasks: [
      'kubectl get nodes shows three Ready nodes',
      'The k alias works: k get nodes',
      'crictl on kq-worker2 lists both tugboat:v1 and tugboat:v2',
      'Restart drill: stop all three node containers with docker stop, start them with the rescue command, and see all nodes Ready again',
      'Open http://localhost:8080 in your Windows browser while a docker run of tugboat:v2 is running, and see the orange page',
    ],
    solution:
      'kubectl get nodes\nk get nodes\ndocker exec kq-worker2 crictl images | grep tugboat\ndocker stop kq-control-plane kq-worker kq-worker2\ndocker start $(docker ps -aq --filter label=io.x-k8s.kind.cluster=kq)\nkubectl get nodes -w            # Ctrl+C once all three say Ready\ndocker run --rm -d -p 8080:8080 --name tb tugboat:v2   # then open http://localhost:8080\ndocker rm -f tb',
  },
  cleanup: '# Nothing to clean: keep the cluster and images for Port 01.',
};
