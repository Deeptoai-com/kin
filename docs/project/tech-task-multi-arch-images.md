# 技术任务单 · 发布多架构镜像（arm64 + amd64）

> 优先级 **P0**（阻塞"Mac mini 一键部署"）。负责人：后端/DevOps。CMO 只验收。
> 目标读者：拿到这页就能直接动手，不用再问。

---

## 1. 一句话目标 + 验收口径
**让 `ghcr.io/deeptoai/kin/app:latest` 同时包含 `linux/amd64` 和 `linux/arm64`，Mac mini 用户 `docker pull` 即得原生镜像、无需本地构建。**

**验收（CMO/QA 签收）：**
- `docker buildx imagetools inspect ghcr.io/deeptoai/kin/app:latest` 同时列出 **linux/amd64** 与 **linux/arm64**。
- 干净 **base M4 16GB Mac mini**：`docker pull` → 跑起来，**全程不本地构建**、≤10 分钟、`/health=ok`、无 "platform mismatch / 模拟" 警告。
- x86 VPS 仍正常（拿到 amd64）。

---

## 2. 现状（精确）
- CI 文件：`.github/workflows/build.yml`，跑在 `ubuntu-latest`（amd64），用 `docker/build-push-action@v6` 但**没有 `platforms:`** → **只构建 linux/amd64**，推 `ghcr.io/<repo>/app:<sha>` + `:latest`。
- 结论：**目前只有 amd64 镜像，没有 arm64。** Mac 用户只能本地构建（Vite 构建峰值 >8GB，8GB Mac OOM）或跑 amd64 模拟（慢）。
- 无技术障碍：Dockerfile 基础镜像 `node:24-bookworm-slim` 本身就是多架构，缺的只是让 CI 同时出两架构。

---

## 3. 推荐方案：原生 arm64 runner 矩阵（不要用 QEMU 跑生产）
**为什么不用 QEMU：** 你的 Vite 构建吃 8GB 堆，在 amd64 上模拟 arm64 会**极慢甚至 OOM**。GitHub 已提供**原生 arm64 runner `ubuntu-24.04-arm`**（公开仓库免费）——每个架构在自己的原生机器上构建，快且稳。做法 = 两个架构分别 by-digest 推送，再合并成一个 manifest list。

**直接替换 `.github/workflows/build.yml` 为：**

```yaml
name: build-image

on:
  push:
    branches: [main]
  workflow_dispatch: {}

permissions:
  contents: read
  packages: write

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/app   # → ghcr.io/deeptoai/kin/app

jobs:
  # 1) 每个架构在原生 runner 上构建，按 digest 推送（先不打 tag）
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: linux/amd64
            runner: ubuntu-latest
          - platform: linux/arm64
            runner: ubuntu-24.04-arm        # 原生 arm64，公开仓库免费
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v4

      - name: Prepare platform name
        run: echo "PLATFORM_PAIR=$(echo '${{ matrix.platform }}' | tr '/' '-')" >> "$GITHUB_ENV"

      - name: Docker meta (labels)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}

      - uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push by digest
        id: build
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: ${{ matrix.platform }}
          labels: ${{ steps.meta.outputs.labels }}
          # 如 Dockerfile 需要 build-args（VITE_WS_URL 等），在此补：
          # build-args: |
          #   VITE_WS_URL=${{ vars.VITE_WS_URL }}
          outputs: type=image,name=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }},push-by-digest=true,name-canonical=true,push=true
          provenance: false

      - name: Export digest
        run: |
          mkdir -p "${{ runner.temp }}/digests"
          digest="${{ steps.build.outputs.digest }}"
          touch "${{ runner.temp }}/digests/${digest#sha256:}"

      - name: Upload digest
        uses: actions/upload-artifact@v4
        with:
          name: digests-${{ env.PLATFORM_PAIR }}
          path: ${{ runner.temp }}/digests/*
          if-no-files-found: error
          retention-days: 1

  # 2) 把两个架构的 digest 合并成一个多架构 tag（latest + sha）
  merge:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Download digests
        uses: actions/download-artifact@v4
        with:
          path: ${{ runner.temp }}/digests
          pattern: digests-*
          merge-multiple: true

      - uses: docker/setup-buildx-action@v3

      - name: Docker meta (tags)
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=raw,value=${{ github.sha }}

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Create multi-arch manifest list
        working-directory: ${{ runner.temp }}/digests
        run: |
          docker buildx imagetools create \
            $(jq -cr '.tags | map("-t " + .) | join(" ")' <<< "$DOCKER_METADATA_OUTPUT_JSON") \
            $(printf '${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@sha256:%s ' *)

      - name: Inspect (should show amd64 + arm64)
        run: docker buildx imagetools inspect ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
```

> 这是 Docker 官方"跨多 runner 分布式构建"的标准范式（per-arch by-digest → imagetools 合并），稳定可靠。

---

## 4. compose 默认改为 pull（不要让用户本地构建）
- 把 app / worker 等服务默认指向**预构建镜像**：`image: ghcr.io/deeptoai/kin/app:latest`。
- 把 `build:` 段挪到一个**可选 override**（如 `docker-compose.build.yml` 或 `--profile build`），仅开发/贡献者用。
- `mac-mini.md` 里"必须本机/换台 Mac 构建"的整段删掉，改为"直接 pull"。
- **验收**：Mac mini 上只 `docker compose up -d`（拉镜像）即可起栈，无 `build` 步骤。

---

## 5. 必须注意的坑（先看再动手）
1. **别用 QEMU 跑生产 arm64 构建**——8GB Vite 构建在模拟下会慢到离谱/可能 OOM。用原生 `ubuntu-24.04-arm`。
2. **`ubuntu-24.04-arm` 免费仅限公开仓库**。Kin 是公开仓库 → 免费可用。若仓库暂时私有：要么先公开、要么自托管 arm runner、要么临时用 QEMU（仅救急）。
3. **Dockerfile 的 arm64 依赖**：runtime 阶段的 apt 包（bubblewrap/python3-numpy/…）与 pip 包（markitdown-mcp/pypdf/…）需在 **bookworm arm64** 上能装。绝大多数有 arm64 包/wheel；个别 pip 包可能在 arm64 源码编译（慢但可成）。**首跑重点盯 arm64 这步是否全绿。**
4. **`provenance: false`** 已加——避免 buildx 给 manifest 塞额外的 attestation 条目，保持 imagetools 合并干净。
5. **GHCR 包可见性**：首次推送后到 GitHub Packages 里把 `kin/app` 设为 **public**（否则匿名 `docker pull` 拉不到）。

---

## 6. 先花 10 分钟做的可行性快测（可选，验证 arm64 能不能 build）
不想先改整个 workflow？先在本地或一个临时 job 跑这个，**只确认 arm64 镜像能构建成功（依赖都解析）**：

```bash
docker buildx create --use
# 只构建 arm64、不推送，验证 Dockerfile 在 arm64 上能过（QEMU，慢，仅验证用）
docker buildx build --platform linux/arm64 -o type=cacheonly .
```
若这步过了，说明 Dockerfile 对 arm64 没硬伤，放心上 §3 的原生矩阵方案。

---

## 7. 验证步骤（做完自检）
```bash
# 1. 确认是多架构
docker buildx imagetools inspect ghcr.io/deeptoai/kin/app:latest
#    → 应同时出现 linux/amd64 和 linux/arm64

# 2. 在 Mac mini 上
docker pull ghcr.io/deeptoai/kin/app:latest
docker image inspect ghcr.io/deeptoai/kin/app:latest --format '{{.Architecture}}'   # → arm64
#    起栈、跑 /health，确认无 "image platform does not match" 警告
```

---

## 8. 验收闸（CMO/QA 签收）
⬜ imagetools inspect 同列 amd64 + arm64
⬜ GHCR 包为 public，匿名可 pull
⬜ 干净 M4 Mac mini：pull→run ≤10 min、无本地构建、无平台/模拟警告、`/health=ok`
⬜ x86 VPS 仍正常拿 amd64 跑通
⬜ compose 默认 pull、`build` 已降为可选
⬜ CI 总时长可接受（arm64 原生不应显著拖慢）
